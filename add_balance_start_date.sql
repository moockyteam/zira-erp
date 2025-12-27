-- 1. Add balance_start_date column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'balance_start_date') THEN
        ALTER TABLE customers ADD COLUMN balance_start_date DATE DEFAULT NULL;
    END IF;
END $$;

-- 2. Update Calculation Function to respect Start Date
CREATE OR REPLACE FUNCTION calculate_customer_balance(target_customer_id UUID) 
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
    WHERE id = target_customer_id;

    -- 1. Sum Valid Invoices (After Start Date)
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_total_invoiced
    FROM invoices 
    WHERE customer_id = target_customer_id 
      AND status NOT IN ('BROUILLON', 'ANNULEE')
      AND (v_start_date IS NULL OR invoice_date >= v_start_date);

    -- 2. Sum Valid Delivery Notes (After Start Date)
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_total_bl
    FROM delivery_notes 
    WHERE customer_id = target_customer_id 
      AND status = 'LIVRE' 
      AND invoice_id IS NULL
      AND (v_start_date IS NULL OR COALESCE(delivery_date, created_at::date) >= v_start_date);

    -- 3. Sum Invoice Payments (After Start Date)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_inv_pay
    FROM invoice_payments p
    JOIN invoices i ON p.invoice_id = i.id
    WHERE i.customer_id = target_customer_id
      AND (v_start_date IS NULL OR payment_date::date >= v_start_date);

    -- 4. Sum BL Payments (After Start Date)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_bl_pay
    FROM delivery_note_payments p
    JOIN delivery_notes dn ON p.delivery_note_id = dn.id
    WHERE dn.customer_id = target_customer_id
      AND (v_start_date IS NULL OR payment_date::date >= v_start_date);

    -- Formula
    v_new_balance := v_initial_balance + (v_total_invoiced + v_total_bl) - (v_total_inv_pay + v_total_bl_pay);
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Update Trigger to also fire when 'balance_start_date' changes
CREATE OR REPLACE FUNCTION update_balance_on_customer_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate if initial_balance OR balance_start_date changes
    IF (NEW.initial_balance IS DISTINCT FROM OLD.initial_balance) OR 
       (NEW.balance_start_date IS DISTINCT FROM OLD.balance_start_date) THEN
        
        UPDATE customers 
        SET balance = calculate_customer_balance(NEW.id)
        WHERE id = NEW.id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger to be sure
DROP TRIGGER IF EXISTS tr_update_cust_balance_initial ON customers;
CREATE TRIGGER tr_update_cust_balance_initial
AFTER UPDATE OF initial_balance, balance_start_date ON customers
FOR EACH ROW
EXECUTE FUNCTION update_balance_on_customer_change();

-- 4. Force Schema Reload
NOTIFY pgrst, 'reload schema';
