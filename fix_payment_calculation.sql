-- =====================================================
-- FIX COMPLET DU SYSTÈME DE PAIEMENT - Version V8
-- 15/01/2026
-- =====================================================
-- 
-- PROBLÈMES IDENTIFIÉS:
-- 1. record_payment() modifie customers.balance directement
-- 2. record_delivery_note_payment() aussi
-- 3. 13+ triggers qui modifient aussi le solde → CHAOS
-- 4. calculate_customer_balance() cherche dans global_payments (inexistante)
--
-- SOLUTION:
-- 1. Corriger calculate_customer_balance() (plus de global_payments)
-- 2. Supprimer modification directe dans record_payment/record_delivery_note_payment
-- 3. Garder UN SEUL trigger qui appelle calculate_customer_balance()
-- 4. Recalculer tous les soldes
-- =====================================================

-- =============================================================================
-- ÉTAPE 1: DÉSACTIVER LES TRIGGERS CONFLICTUELS
-- =============================================================================

-- Triggers sur invoice_payments
DROP TRIGGER IF EXISTS trg_update_customer_balance_payments ON invoice_payments;
DROP TRIGGER IF EXISTS tr_balance_invoice_payments ON invoice_payments;

-- Triggers sur delivery_note_payments
DROP TRIGGER IF EXISTS tr_update_cust_balance_bl_pay ON delivery_note_payments;
DROP TRIGGER IF EXISTS tr_balance_dn_payments ON delivery_note_payments;

-- Triggers sur invoices (garder seulement un)
DROP TRIGGER IF EXISTS trigger_invoices_balance_update ON invoices;
DROP TRIGGER IF EXISTS trg_update_customer_balance_invoices ON invoices;
-- DROP TRIGGER IF EXISTS tr_balance_invoices ON invoices; -- On garde celui-ci

-- Triggers sur delivery_notes
DROP TRIGGER IF EXISTS tr_update_cust_balance_bl ON delivery_notes;
-- DROP TRIGGER IF EXISTS tr_balance_delivery_notes ON delivery_notes; -- On garde celui-ci

-- Triggers sur l'ancienne table payments (si elle existe)
DROP TRIGGER IF EXISTS on_payment_change ON payments;
DROP TRIGGER IF EXISTS trigger_payments_balance_update ON payments;
DROP TRIGGER IF EXISTS trg_update_customer_balance_payments ON payments;

-- =============================================================================
-- ÉTAPE 2: FONCTION calculate_customer_balance CORRIGÉE
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_customer_balance(p_customer_id UUID) 
RETURNS DECIMAL AS $$
DECLARE
    v_initial_balance DECIMAL := 0;
    v_total_invoiced DECIMAL := 0;
    v_total_bl DECIMAL := 0;
    v_total_inv_pay DECIMAL := 0;
    v_total_bl_pay DECIMAL := 0;
    v_total_credits DECIMAL := 0;
    v_balance_start_date DATE := NULL;
    v_new_balance DECIMAL := 0;
BEGIN
    -- 0. Récupérer initial_balance et balance_start_date
    SELECT COALESCE(initial_balance, 0), balance_start_date 
    INTO v_initial_balance, v_balance_start_date
    FROM customers
    WHERE id = p_customer_id;

    -- 1. Somme des Factures Valides
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_total_invoiced
    FROM invoices 
    WHERE customer_id = p_customer_id 
      AND status NOT IN ('BROUILLON', 'ANNULEE')
      AND source_delivery_note_id IS NULL
      AND (v_balance_start_date IS NULL OR invoice_date >= v_balance_start_date);

    -- 2. Somme des BL Valides (Livrés, Non Facturés)
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_total_bl
    FROM delivery_notes 
    WHERE customer_id = p_customer_id 
      AND status = 'LIVRE' 
      AND invoice_id IS NULL
      AND (is_valued = true OR total_ttc > 0)
      AND (v_balance_start_date IS NULL OR COALESCE(delivery_date, created_at)::date >= v_balance_start_date);

    -- 3. Somme des Paiements sur Factures
    SELECT COALESCE(SUM(p.amount), 0) INTO v_total_inv_pay
    FROM invoice_payments p
    JOIN invoices i ON p.invoice_id = i.id
    WHERE i.customer_id = p_customer_id
      AND (v_balance_start_date IS NULL OR p.payment_date >= v_balance_start_date);

    -- 4. Somme des Paiements sur BL
    SELECT COALESCE(SUM(p.amount), 0) INTO v_total_bl_pay
    FROM delivery_note_payments p
    JOIN delivery_notes dn ON p.delivery_note_id = dn.id
    WHERE dn.customer_id = p_customer_id
      AND (v_balance_start_date IS NULL OR p.payment_date >= v_balance_start_date);

    -- 5. Somme des Crédits Clients (avances non allouées)
    -- NOTE: Plus de global_payments! Les paiements globaux sont déjà dans invoice_payments/delivery_note_payments
    BEGIN
        SELECT COALESCE(SUM(amount), 0) INTO v_total_credits
        FROM customer_credits
        WHERE customer_id = p_customer_id
          AND (v_balance_start_date IS NULL OR payment_date >= v_balance_start_date);
    EXCEPTION WHEN undefined_table THEN
        v_total_credits := 0;
    END;

    -- FORMULE: Solde = Initial + Documents - Paiements - Crédits
    v_new_balance := v_initial_balance 
        + v_total_invoiced 
        + v_total_bl 
        - v_total_inv_pay 
        - v_total_bl_pay 
        - v_total_credits;
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ÉTAPE 3: FONCTION record_payment CORRIGÉE (SANS modification directe)
-- =============================================================================

CREATE OR REPLACE FUNCTION record_payment(
  p_company_id UUID,
  p_customer_id UUID,
  p_amount DECIMAL,
  p_payment_method TEXT,
  p_payment_date DATE,
  p_notes TEXT,
  p_invoice_id UUID,
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

  -- Insérer le paiement
  INSERT INTO invoice_payments (
    invoice_id,
    amount,
    payment_date,
    payment_method,
    notes
  ) VALUES (
    p_invoice_id,
    p_amount,
    p_payment_date,
    p_payment_method,
    p_notes
  ) RETURNING id INTO v_payment_id;

  -- Calculer le total payé
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

  -- ⚠️ NE PLUS MODIFIER customers.balance DIRECTEMENT!
  -- Le trigger update_balance_generic_trigger s'en chargera
  -- OU on le calcule juste pour le retour:
  SELECT calculate_customer_balance(p_customer_id) INTO v_new_balance;

  RETURN json_build_object(
    'payment_id', v_payment_id,
    'new_balance', v_new_balance,
    'new_status', v_new_status,
    'total_paid', v_total_paid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ÉTAPE 4: FONCTION record_delivery_note_payment CORRIGÉE
-- =============================================================================

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
  
  -- Insérer le paiement
  INSERT INTO delivery_note_payments (
    delivery_note_id, 
    amount, 
    payment_date, 
    payment_method, 
    notes, 
    bank_name, 
    check_number, 
    check_date
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

  -- ⚠️ NE PLUS MODIFIER customers.balance DIRECTEMENT!
  SELECT calculate_customer_balance(v_customer_id) INTO v_new_balance;

  RETURN json_build_object(
    'payment_id', v_payment_id,
    'customer_id', v_customer_id,
    'new_balance', v_new_balance,
    'amount', p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ÉTAPE 5: TRIGGER UNIFIÉ pour mettre à jour le solde
-- =============================================================================

CREATE OR REPLACE FUNCTION update_balance_generic_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_customer_id UUID;
    v_new_balance DECIMAL;
BEGIN
    -- Déterminer le customer_id selon la table source
    IF TG_TABLE_NAME = 'invoices' THEN
        v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
    ELSIF TG_TABLE_NAME = 'delivery_notes' THEN
        v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
    ELSIF TG_TABLE_NAME = 'invoice_payments' THEN
        SELECT i.customer_id INTO v_customer_id
        FROM invoices i
        WHERE i.id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    ELSIF TG_TABLE_NAME = 'delivery_note_payments' THEN
        SELECT dn.customer_id INTO v_customer_id
        FROM delivery_notes dn
        WHERE dn.id = COALESCE(NEW.delivery_note_id, OLD.delivery_note_id);
    ELSIF TG_TABLE_NAME = 'customer_credits' THEN
        v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
    END IF;

    -- Recalculer et mettre à jour le solde
    IF v_customer_id IS NOT NULL THEN
        SELECT calculate_customer_balance(v_customer_id) INTO v_new_balance;
        UPDATE customers SET balance = v_new_balance WHERE id = v_customer_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ÉTAPE 6: Recréer les triggers nécessaires (1 par table)
-- =============================================================================

-- Sur invoice_payments
DROP TRIGGER IF EXISTS tr_balance_invoice_payments ON invoice_payments;
CREATE TRIGGER tr_balance_invoice_payments 
    AFTER INSERT OR DELETE OR UPDATE ON invoice_payments 
    FOR EACH ROW EXECUTE FUNCTION update_balance_generic_trigger();

-- Sur delivery_note_payments
DROP TRIGGER IF EXISTS tr_balance_dn_payments ON delivery_note_payments;
CREATE TRIGGER tr_balance_dn_payments 
    AFTER INSERT OR DELETE OR UPDATE ON delivery_note_payments 
    FOR EACH ROW EXECUTE FUNCTION update_balance_generic_trigger();

-- Sur invoices
DROP TRIGGER IF EXISTS tr_balance_invoices ON invoices;
CREATE TRIGGER tr_balance_invoices 
    AFTER INSERT OR DELETE OR UPDATE OF total_ttc, status, customer_id ON invoices 
    FOR EACH ROW EXECUTE FUNCTION update_balance_generic_trigger();

-- Sur delivery_notes
DROP TRIGGER IF EXISTS tr_balance_delivery_notes ON delivery_notes;
CREATE TRIGGER tr_balance_delivery_notes 
    AFTER INSERT OR DELETE OR UPDATE OF total_ttc, status, customer_id, invoice_id ON delivery_notes 
    FOR EACH ROW EXECUTE FUNCTION update_balance_generic_trigger();

-- Sur customer_credits
DROP TRIGGER IF EXISTS tr_balance_customer_credits ON customer_credits;
CREATE TRIGGER tr_balance_customer_credits 
    AFTER INSERT OR DELETE OR UPDATE ON customer_credits 
    FOR EACH ROW EXECUTE FUNCTION update_balance_generic_trigger();

-- =============================================================================
-- ÉTAPE 7: MIGRATION - Recalculer TOUS les soldes clients
-- =============================================================================

DO $$
DECLARE
    r RECORD;
    v_calculated DECIMAL;
    v_count INTEGER := 0;
BEGIN
    FOR r IN SELECT id, name, balance FROM customers LOOP
        SELECT calculate_customer_balance(r.id) INTO v_calculated;
        IF r.balance IS DISTINCT FROM v_calculated THEN
            UPDATE customers SET balance = v_calculated WHERE id = r.id;
            v_count := v_count + 1;
            RAISE NOTICE 'Client % corrigé: % -> %', r.name, r.balance, v_calculated;
        END IF;
    END LOOP;
    RAISE NOTICE '=== MIGRATION TERMINÉE: % soldes corrigés ===', v_count;
END $$;

-- =============================================================================
-- PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION calculate_customer_balance(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_payment(UUID, UUID, DECIMAL, TEXT, DATE, TEXT, UUID, TEXT, TEXT, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_delivery_note_payment(UUID, DECIMAL, DATE, TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_balance_generic_trigger() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
