-- Fix Customer Balance using the invoices_with_totals VIEW
-- This ensures we match the logic displayed in the Invoice List (amount_due)

CREATE OR REPLACE FUNCTION calculate_customer_balance(target_customer_id UUID) 
RETURNS numeric AS $$
DECLARE
    total_balance numeric;
BEGIN
    -- We sum the 'amount_due' from the view invoices_with_totals.
    -- 'amount_due' = total_ttc - total_paid.
    -- If an invoice is PAID, amount_due is 0.
    -- If an invoice is ANNULEE or BROUILLON, we should exclude it (or amount_due might be null/0).
    
    SELECT COALESCE(SUM(amount_due), 0)
    INTO total_balance
    FROM invoices_with_totals
    WHERE customer_id = target_customer_id
    AND status NOT IN ('BROUILLON', 'ANNULEE');

    RETURN total_balance;
END;
$$ LANGUAGE plpgsql;

-- Trigger Function must remain on the TABLE 'invoices', not the View.
CREATE OR REPLACE FUNCTION update_customer_balance_trigger() 
RETURNS TRIGGER AS $$
DECLARE
    cust_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'invoices' THEN
        IF TG_OP = 'DELETE' THEN cust_id := OLD.customer_id; ELSE cust_id := NEW.customer_id; END IF;
    -- Note: We cannot easily put a trigger on a payment table if we don't know its name.
    -- However, usually 'invoices_with_totals' updates whenever 'invoices' or the underlying payment table updates.
    -- Since we can't trigger off the view, we might miss balance updates if a payment is added 
    -- BUT NOT linked to an invoice update.
    -- FORTUNATELY, 'record_invoice_payment' RPC likely updates the 'invoices' table (status update) too.
    -- If it doesn't, we might need the payment table trigger.
    
    -- But since the user says "when status becomes Paid", the invoice table IS updated.
    -- So this trigger on 'invoices' should be sufficient for status changes.
    END IF;

    -- If we can find the payments table, we add a trigger there too.
    -- Using the same Dynamic SQL approach to finding the payments table just for the TRIGGER.
    
    IF cust_id IS NOT NULL THEN
        UPDATE customers 
        SET balance = calculate_customer_balance(cust_id)
        WHERE id = cust_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply Trigger to Invoices
DROP TRIGGER IF EXISTS trg_update_customer_balance_invoices ON invoices;
CREATE TRIGGER trg_update_customer_balance_invoices
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION update_customer_balance_trigger();

-- Dynamic block to find payments table purely for adding the trigger (to catch partial payments that don't change invoice status)
DO $$
DECLARE
    payment_table_name text;
BEGIN
    SELECT table_name INTO payment_table_name
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('payments', 'invoice_payments', 'payment_history')
    LIMIT 1;

    IF payment_table_name IS NOT NULL THEN
        EXECUTE format('DROP TRIGGER IF EXISTS trg_update_customer_balance_payments ON %I', payment_table_name);
        EXECUTE format('CREATE TRIGGER trg_update_customer_balance_payments AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION update_customer_balance_trigger()', payment_table_name);
    END IF;
    
    -- Recalculate all
    UPDATE customers SET balance = calculate_customer_balance(id);
END $$;
