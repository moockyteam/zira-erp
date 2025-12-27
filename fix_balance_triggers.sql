-- Comprehensive Fix for Customer Balance Triggers & Logic

-- 1. Ensure the calculation function is solid (Recap from previous step, ensuring it exists)
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

    -- 2. Sum Valid Delivery Notes (Delivered, Valued, Not Invoiced)
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_total_bl
    FROM delivery_notes 
    WHERE customer_id = target_customer_id 
      AND status = 'LIVRE' 
      AND (invoice_id IS NULL)
      AND (is_valued = true OR total_ttc > 0);

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

    -- Formula: Initial + (Invoiced + BLs) - (InvPayments + BLPayments)
    v_new_balance := v_initial_balance + (v_total_invoiced + v_total_bl) - (v_total_inv_pay + v_total_bl_pay);
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Generic Trigger Function for any change affecting customer balance
CREATE OR REPLACE FUNCTION update_balance_generic_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_customer_id UUID;
    v_invoice_id UUID;
    v_bl_id UUID;
BEGIN
    -- Determine Customer ID based on table
    -- INVOICES
    IF TG_TABLE_NAME = 'invoices' THEN
        v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
        
    -- DELIVERY_NOTES
    ELSIF TG_TABLE_NAME = 'delivery_notes' THEN
        v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
        
    -- INVOICE_PAYMENTS
    ELSIF TG_TABLE_NAME = 'invoice_payments' THEN
        -- Need to join with invoices to find customer
        IF (TG_OP = 'DELETE') THEN
            v_invoice_id := OLD.invoice_id;
        ELSE
            v_invoice_id := NEW.invoice_id;
        END IF;
        SELECT customer_id INTO v_customer_id FROM invoices WHERE id = v_invoice_id;
        
    -- DELIVERY_NOTE_PAYMENTS
    ELSIF TG_TABLE_NAME = 'delivery_note_payments' THEN
        -- Need to join with delivery_notes to find customer
        IF (TG_OP = 'DELETE') THEN
            v_bl_id := OLD.delivery_note_id;
        ELSE
            v_bl_id := NEW.delivery_note_id;
        END IF;
        SELECT customer_id INTO v_customer_id FROM delivery_notes WHERE id = v_bl_id;
    END IF;

    -- Update Balance if customer found
    IF v_customer_id IS NOT NULL THEN
        UPDATE customers 
        SET balance = calculate_customer_balance(v_customer_id)
        WHERE id = v_customer_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Apply Triggers to ALL Relevant Tables

-- A. Invoices
DROP TRIGGER IF EXISTS tr_balance_invoices ON invoices;
CREATE TRIGGER tr_balance_invoices
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION update_balance_generic_trigger();

-- B. Delivery Notes
DROP TRIGGER IF EXISTS tr_balance_delivery_notes ON delivery_notes;
CREATE TRIGGER tr_balance_delivery_notes
AFTER INSERT OR UPDATE OR DELETE ON delivery_notes
FOR EACH ROW EXECUTE FUNCTION update_balance_generic_trigger();

-- C. Invoice Payments !! (THIS WAS MISSING)
DROP TRIGGER IF EXISTS tr_balance_invoice_payments ON invoice_payments;
CREATE TRIGGER tr_balance_invoice_payments
AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
FOR EACH ROW EXECUTE FUNCTION update_balance_generic_trigger();

-- D. Delivery Note Payments
DROP TRIGGER IF EXISTS tr_balance_dn_payments ON delivery_note_payments;
CREATE TRIGGER tr_balance_dn_payments
AFTER INSERT OR UPDATE OR DELETE ON delivery_note_payments
FOR EACH ROW EXECUTE FUNCTION update_balance_generic_trigger();


-- 4. Initial Recalculation (Force update everyone now)
UPDATE customers SET balance = calculate_customer_balance(id);

-- 5. Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';
