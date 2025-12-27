-- Function to Register a Global Payment (Version 2 - New Name to fix Cache)
-- We renamed it to 'record_global_payment' and changed p_date to DATE type
CREATE OR REPLACE FUNCTION record_global_payment(
    p_customer_id UUID,
    p_amount DECIMAL,
    p_payment_method TEXT,
    p_notes TEXT,
    p_date DATE DEFAULT CURRENT_DATE
) 
RETURNS JSONB AS $$
DECLARE
    v_remaining_amount DECIMAL := p_amount;
    v_allocated_amount DECIMAL := 0;
    v_pay_amount DECIMAL := 0;
    v_doc_balance DECIMAL := 0;
    r_doc RECORD;
    v_payment_id UUID;
    v_result JSONB := '[]';
BEGIN
    -- Validation
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive';
    END IF;

    -- Iterate through unpaid documents ordered by date (Oldest first)
    FOR r_doc IN 
        (
            -- 1. Unpaid Invoices
            SELECT 
                i.id, 
                'INVOICE' as type, 
                i.invoice_date as doc_date, 
                i.invoice_number as reference,
                i.total_ttc,
                COALESCE(SUM(p.amount), 0) as paid_so_far,
                (i.total_ttc - COALESCE(SUM(p.amount), 0)) as balance
            FROM invoices i
            LEFT JOIN invoice_payments p ON i.id = p.invoice_id
            WHERE i.customer_id = p_customer_id
              AND i.status NOT IN ('BROUILLON', 'ANNULEE') -- Only valid invoices
            GROUP BY i.id
            HAVING (i.total_ttc - COALESCE(SUM(p.amount), 0)) > 0.001 -- Float tolerance

            UNION ALL

            -- 2. Unpaid Delivery Notes
            SELECT 
                dn.id, 
                'DELIVERY_NOTE' as type, 
                COALESCE(dn.delivery_date, dn.created_at) as doc_date, 
                dn.delivery_note_number as reference,
                dn.total_ttc,
                COALESCE(SUM(p.amount), 0) as paid_so_far,
                (dn.total_ttc - COALESCE(SUM(p.amount), 0)) as balance
            FROM delivery_notes dn
            LEFT JOIN delivery_note_payments p ON dn.id = p.delivery_note_id
            WHERE dn.customer_id = p_customer_id
              AND dn.status = 'LIVRE' -- Delivered only
              AND dn.invoice_id IS NULL -- Not invoiced
              AND (dn.is_valued = true OR dn.total_ttc > 0) -- Valued
            GROUP BY dn.id
            HAVING (dn.total_ttc - COALESCE(SUM(p.amount), 0)) > 0.001

            ORDER BY doc_date ASC -- FIFO
        )
    LOOP
        -- Exit if no money left
        IF v_remaining_amount <= 0 THEN
            EXIT;
        END IF;

        -- Calculate how much to pay on this doc
        v_doc_balance := r_doc.balance;
        v_pay_amount := LEAST(v_remaining_amount, v_doc_balance);

        -- Insert Payment
        -- Use simple string casting for notes to avoid issues
        IF r_doc.type = 'INVOICE' THEN
            INSERT INTO invoice_payments (
                invoice_id, 
                amount, 
                payment_date, 
                payment_method, 
                notes
            ) VALUES (
                r_doc.id,
                v_pay_amount,
                p_date::TIMESTAMP, -- Cast back to timestamp for table column
                p_payment_method,
                COALESCE(p_notes, '') || ' (Alloc. Auto)'
            ) RETURNING id INTO v_payment_id;
            
        ELSIF r_doc.type = 'DELIVERY_NOTE' THEN
             INSERT INTO delivery_note_payments (
                delivery_note_id, 
                amount, 
                payment_date, 
                payment_method, 
                notes
            ) VALUES (
                r_doc.id,
                v_pay_amount,
                p_date::TIMESTAMP,
                p_payment_method,
                COALESCE(p_notes, '') || ' (Alloc. Auto)'
            ) RETURNING id INTO v_payment_id;
        END IF;

        -- Update loop tracking
        v_remaining_amount := v_remaining_amount - v_pay_amount;
        v_allocated_amount := v_allocated_amount + v_pay_amount;

        -- Log result
        v_result := v_result || jsonb_build_object(
            'document_type', r_doc.type,
            'reference', r_doc.reference,
            'amount_paid', v_pay_amount
        );

    END LOOP;

    RETURN jsonb_build_object(
        'total_paid', v_allocated_amount,
        'remaining_unallocated', v_remaining_amount,
        'allocations', v_result
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION record_global_payment(UUID, DECIMAL, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION record_global_payment(UUID, DECIMAL, TEXT, TEXT, DATE) TO service_role;

-- Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';
