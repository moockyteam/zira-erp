-- =====================================================
-- FIX: Fonction record_payment - Version Corrigée
-- Basée sur la structure RÉELLE de invoice_payments
-- =====================================================
-- Colonnes invoice_payments: id, invoice_id, amount, payment_date, 
--                            payment_method, notes, created_at, global_payment_id
-- =====================================================

CREATE OR REPLACE FUNCTION record_payment(
  p_company_id UUID,
  p_customer_id UUID,
  p_amount DECIMAL,
  p_payment_method TEXT,
  p_payment_date DATE,
  p_notes TEXT,
  p_invoice_id UUID,
  -- Ces params sont acceptés mais IGNORÉS (pour compatibilité avec le frontend)
  p_bank_name TEXT DEFAULT NULL,
  p_check_number TEXT DEFAULT NULL,
  p_check_date DATE DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_payment_id UUID;
  v_new_balance DECIMAL;
  v_total_ttc DECIMAL;
  v_total_paid DECIMAL;
  v_new_status TEXT;
BEGIN
  -- Validation
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être positif';
  END IF;

  IF p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'ID de la facture requis';
  END IF;

  -- Récupérer le total TTC de la facture
  SELECT total_ttc INTO v_total_ttc
  FROM invoices
  WHERE id = p_invoice_id;

  IF v_total_ttc IS NULL THEN
    RAISE EXCEPTION 'Facture introuvable';
  END IF;

  -- Insérer le paiement (UNIQUEMENT les colonnes qui existent!)
  INSERT INTO invoice_payments (
    invoice_id,
    amount,
    payment_date,
    payment_method,
    notes
    -- PAS de bank_name, check_number, check_date (colonnes inexistantes)
    -- PAS de global_payment_id (NULL = paiement direct)
  ) VALUES (
    p_invoice_id,
    p_amount,
    p_payment_date,
    p_payment_method,
    p_notes
  ) RETURNING id INTO v_payment_id;

  -- Calculer le total payé (somme de tous les paiements sur cette facture)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM invoice_payments
  WHERE invoice_id = p_invoice_id;

  -- Déterminer le nouveau statut
  IF v_total_paid >= (v_total_ttc - 0.001) THEN
    v_new_status := 'PAYEE';
  ELSE
    v_new_status := 'PARTIELLEMENT_PAYEE';
  END IF;

  -- Mettre à jour le statut de la facture
  UPDATE invoices
  SET status = v_new_status
  WHERE id = p_invoice_id;

  -- Mettre à jour le solde client
  UPDATE customers
  SET balance = balance - p_amount
  WHERE id = p_customer_id
  RETURNING balance INTO v_new_balance;

  RETURN json_build_object(
    'payment_id', v_payment_id,
    'new_balance', v_new_balance,
    'new_status', v_new_status,
    'total_paid', v_total_paid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions
GRANT EXECUTE ON FUNCTION record_payment(UUID, UUID, DECIMAL, TEXT, DATE, TEXT, UUID, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION record_payment(UUID, UUID, DECIMAL, TEXT, DATE, TEXT, UUID, TEXT, TEXT, DATE) TO service_role;

NOTIFY pgrst, 'reload schema';
