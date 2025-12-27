-- ULTIMATE FIX: Schema + Functions + Triggers
-- Run this ONCE to fix everything.

-- 1. Ensure 'initial_balance' column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'initial_balance') THEN
        ALTER TABLE customers ADD COLUMN initial_balance DECIMAL DEFAULT 0;
    END IF;
END $$;

-- 2. Update the Calculation Function (Now safe to use 'initial_balance')
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

    -- 1. Sum Valid Invoices
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_total_invoiced
    FROM invoices 
    WHERE customer_id = target_customer_id 
      AND status NOT IN ('BROUILLON', 'ANNULEE');

    -- 2. Sum Valid Delivery Notes
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

    -- Formula
    v_new_balance := v_initial_balance + (v_total_invoiced + v_total_bl) - (v_total_inv_pay + v_total_bl_pay);
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Generic Trigger Function
CREATE OR REPLACE FUNCTION update_balance_generic_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_customer_id UUID;
    v_invoice_id UUID;
    v_bl_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'invoices' THEN
        v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
    ELSIF TG_TABLE_NAME = 'delivery_notes' THEN
        v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
    ELSIF TG_TABLE_NAME = 'invoice_payments' THEN
        IF (TG_OP = 'DELETE') THEN v_invoice_id := OLD.invoice_id; ELSE v_invoice_id := NEW.invoice_id; END IF;
        SELECT customer_id INTO v_customer_id FROM invoices WHERE id = v_invoice_id;
    ELSIF TG_TABLE_NAME = 'delivery_note_payments' THEN
        IF (TG_OP = 'DELETE') THEN v_bl_id := OLD.delivery_note_id; ELSE v_bl_id := NEW.delivery_note_id; END IF;
        SELECT customer_id INTO v_customer_id FROM delivery_notes WHERE id = v_bl_id;
    END IF;

    IF v_customer_id IS NOT NULL THEN
        UPDATE customers 
        SET balance = calculate_customer_balance(v_customer_id)
        WHERE id = v_customer_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Re-Apply Triggers (Ensures they exist)
DROP TRIGGER IF EXISTS tr_balance_invoices ON invoices;
CREATE TRIGGER tr_balance_invoices AFTER INSERT OR UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION update_balance_generic_trigger();

DROP TRIGGER IF EXISTS tr_balance_delivery_notes ON delivery_notes;
CREATE TRIGGER tr_balance_delivery_notes AFTER INSERT OR UPDATE OR DELETE ON delivery_notes FOR EACH ROW EXECUTE FUNCTION update_balance_generic_trigger();

DROP TRIGGER IF EXISTS tr_balance_invoice_payments ON invoice_payments;
CREATE TRIGGER tr_balance_invoice_payments AFTER INSERT OR UPDATE OR DELETE ON invoice_payments FOR EACH ROW EXECUTE FUNCTION update_balance_generic_trigger();

DROP TRIGGER IF EXISTS tr_balance_dn_payments ON delivery_note_payments;
CREATE TRIGGER tr_balance_dn_payments AFTER INSERT OR UPDATE OR DELETE ON delivery_note_payments FOR EACH ROW EXECUTE FUNCTION update_balance_generic_trigger();


-- 5. Trigger for Initial Balance Change
CREATE OR REPLACE FUNCTION update_balance_on_initial_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.initial_balance IS DISTINCT FROM OLD.initial_balance THEN
        UPDATE customers 
        SET balance = calculate_customer_balance(NEW.id)
        WHERE id = NEW.id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_update_cust_balance_initial ON customers;
CREATE TRIGGER tr_update_cust_balance_initial AFTER UPDATE OF initial_balance ON customers FOR EACH ROW EXECUTE FUNCTION update_balance_on_initial_change();


-- 6. Recalculate ALL balances now
UPDATE customers SET balance = calculate_customer_balance(id);

-- 7. Flush Schema Cache
NOTIFY pgrst, 'reload schema';
