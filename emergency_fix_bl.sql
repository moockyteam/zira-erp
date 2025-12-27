-- EMERGENCY FIX: Simplify BL Balance Logic
-- This counts ALL Delivered Delivery Notes that are NOT invoiced, regardless of 'is_valued' flag.

CREATE OR REPLACE FUNCTION calculate_customer_balance(target_customer_id UUID) 
RETURNS DECIMAL AS $$
DECLARE
    v_initial_balance DECIMAL := 0;
    v_total_invoiced DECIMAL := 0;
    v_total_bl DECIMAL := 0;
    v_total_inv_pay DECIMAL := 0;
    v_total_bl_pay DECIMAL := 0;
    v_new_balance DECIMAL := 0;
BEGIN
    -- 0. Get Initial Balance
    SELECT COALESCE(initial_balance, 0) INTO v_initial_balance
    FROM customers
    WHERE id = target_customer_id;

    -- 1. Sum Valid Invoices (Validated/Sent/Partial/Paid)
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_total_invoiced
    FROM invoices 
    WHERE customer_id = target_customer_id 
      AND status NOT IN ('BROUILLON', 'ANNULEE');

    -- 2. Sum Valid Delivery Notes (SIMPLIFIED LOGIC)
    -- Counts all 'LIVRE' notes that have no invoice link.
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_total_bl
    FROM delivery_notes 
    WHERE customer_id = target_customer_id 
      AND status = 'LIVRE' 
      AND invoice_id IS NULL;  -- REMOVED 'is_valued' check to force inclusion

    -- 3. Sum Invoice Payments
    SELECT COALESCE(SUM(amount), 0) INTO v_total_inv_pay
    FROM invoice_payments p
    JOIN invoices i ON p.invoice_id = i.id
    WHERE i.customer_id = target_customer_id;

    -- 4. Sum BL Payments
    SELECT COALESCE(SUM(amount), 0) INTO v_total_bl_pay
    FROM delivery_note_payments p
    JOIN delivery_notes dn ON p.delivery_note_id = dn.id
    WHERE dn.customer_id = target_customer_id;

    -- Formula
    v_new_balance := v_initial_balance + (v_total_invoiced + v_total_bl) - (v_total_inv_pay + v_total_bl_pay);
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Force Recalculation NOW
UPDATE customers SET balance = calculate_customer_balance(id);

-- Flush Schema Cache
NOTIFY pgrst, 'reload schema';
