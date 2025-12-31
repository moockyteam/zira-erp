-- FIX PARAMETER NAME MISMATCH
-- The frontend sends 'p_customer_id', but the function expected 'target_customer_id'.

CREATE OR REPLACE FUNCTION calculate_customer_balance(p_customer_id UUID) 
RETURNS DECIMAL AS $$
DECLARE
    v_initial_balance DECIMAL := 0;
    v_start_date DATE;
    v_total_invoiced DECIMAL := 0;
    v_total_bl DECIMAL := 0;
    v_total_inv_pay DECIMAL := 0;
    v_total_bl_pay DECIMAL := 0;
    v_new_balance DECIMAL := 0;
BEGIN
    -- 0. Get Customer Settings
    SELECT COALESCE(initial_balance, 0), balance_start_date 
    INTO v_initial_balance, v_start_date
    FROM customers
    WHERE id = p_customer_id;

    -- 1. Sum Valid Invoices (After Start Date)
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_total_invoiced
    FROM invoices 
    WHERE customer_id = p_customer_id 
      AND status NOT IN ('BROUILLON', 'ANNULEE')
      AND (v_start_date IS NULL OR invoice_date >= v_start_date);

    -- 2. Sum Valid Delivery Notes (After Start Date)
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_total_bl
    FROM delivery_notes 
    WHERE customer_id = p_customer_id 
      AND status = 'LIVRE' 
      AND invoice_id IS NULL
      AND (v_start_date IS NULL OR COALESCE(delivery_date, created_at)::date >= v_start_date);

    -- 3. Sum Invoice Payments (After Start Date)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_inv_pay
    FROM invoice_payments p
    JOIN invoices i ON p.invoice_id = i.id
    WHERE i.customer_id = p_customer_id
      AND (v_start_date IS NULL OR payment_date::date >= v_start_date);

    -- 4. Sum BL Payments (After Start Date)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_bl_pay
    FROM delivery_note_payments p
    JOIN delivery_notes dn ON p.delivery_note_id = dn.id
    WHERE dn.customer_id = p_customer_id
      AND (v_start_date IS NULL OR payment_date::date >= v_start_date);

    -- Formula
    v_new_balance := v_initial_balance + (v_total_invoiced + v_total_bl) - (v_total_inv_pay + v_total_bl_pay);
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload Schema
NOTIFY pgrst, 'reload schema';
