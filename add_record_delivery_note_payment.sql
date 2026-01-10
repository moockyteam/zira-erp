-- =====================================================
-- Fonction record_delivery_note_payment - Version Corrigée
-- Basée sur la structure RÉELLE de delivery_note_payments
-- =====================================================
-- Colonnes: id, delivery_note_id, amount, payment_date, payment_method,
--           notes, bank_name, check_number, check_date, created_at, 
--           updated_at, global_payment_id
-- =====================================================

CREATE OR REPLACE FUNCTION record_delivery_note_payment(
  p_delivery_note_id UUID,
  p_amount DECIMAL,
  p_payment_date DATE,
  p_payment_method TEXT,
  p_notes TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_check_number TEXT DEFAULT NULL,
  p_check_date DATE DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_payment_id UUID;
  v_customer_id UUID;
  v_new_balance DECIMAL;
BEGIN
  -- Validation
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être positif';
  END IF;

  IF p_delivery_note_id IS NULL THEN
    RAISE EXCEPTION 'ID du bon de livraison requis';
  END IF;

  -- Récupérer le customer_id du BL
  SELECT customer_id INTO v_customer_id 
  FROM delivery_notes 
  WHERE id = p_delivery_note_id;
  
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Bon de livraison introuvable';
  END IF;
  
  -- Insérer le paiement (toutes les colonnes qui existent)
  INSERT INTO delivery_note_payments (
    delivery_note_id, 
    amount, 
    payment_date, 
    payment_method, 
    notes, 
    bank_name, 
    check_number, 
    check_date
    -- PAS de global_payment_id (NULL = paiement direct)
  ) VALUES (
    p_delivery_note_id, 
    p_amount, 
    p_payment_date, 
    p_payment_method, 
    p_notes, 
    p_bank_name, 
    p_check_number, 
    p_check_date
  ) RETURNING id INTO v_payment_id;

  -- Mettre à jour le solde client
  UPDATE customers
  SET balance = balance - p_amount
  WHERE id = v_customer_id
  RETURNING balance INTO v_new_balance;

  RETURN json_build_object(
    'payment_id', v_payment_id,
    'customer_id', v_customer_id,
    'new_balance', v_new_balance,
    'amount', p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions
GRANT EXECUTE ON FUNCTION record_delivery_note_payment(UUID, DECIMAL, DATE, TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION record_delivery_note_payment(UUID, DECIMAL, DATE, TEXT, TEXT, TEXT, TEXT, DATE) TO service_role;

NOTIFY pgrst, 'reload schema';
