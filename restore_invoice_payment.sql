
-- REPAIR/RESTORE record_payment for INVOICES only
-- This ensures that invoices continue to use 'invoice_payments' table as requested

CREATE OR REPLACE FUNCTION record_payment(
  p_company_id UUID,
  p_customer_id UUID,
  p_amount DECIMAL,
  p_payment_method TEXT,
  p_payment_date DATE,
  p_notes TEXT,
  p_invoice_id UUID, -- Mandatory for this function now
  p_bank_name TEXT DEFAULT NULL,
  p_check_number TEXT DEFAULT NULL,
  p_check_date DATE DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_payment_id UUID;
  v_new_balance DECIMAL;
BEGIN
  -- Insert Payment into INVOICE_PAYMENTS (Restoring original behavior)
  INSERT INTO invoice_payments (
    invoice_id,
    amount,
    payment_date,
    payment_method,
    notes,
    bank_name,
    check_number,
    check_date
    -- Add created_at, etc if needed defaults are fine
  ) VALUES (
    p_invoice_id,
    p_amount,
    p_payment_date,
    p_payment_method,
    p_notes,
    p_bank_name,
    p_check_number,
    p_check_date
  ) RETURNING id INTO v_payment_id;

  -- Update Invoice Status
  UPDATE invoices
  SET total_paid = total_paid + p_amount,
      status = CASE 
        WHEN total_paid + p_amount >= total_ttc THEN 'PAYEE'
        ELSE 'PARTIELLEMENT_PAYEE'
      END
  WHERE id = p_invoice_id;

  -- Update Customer Balance
  -- Assumes balance logic triggers or is handled here.
  -- Mirroring the logic we used for BL
  UPDATE customers
  SET balance = balance - p_amount
  WHERE id = p_customer_id
  RETURNING balance INTO v_new_balance;

  RETURN json_build_object(
    'payment_id', v_payment_id,
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql;
