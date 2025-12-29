-- Migration: Ajout de source_delivery_note_id pour la conversion BL → Facture
-- À exécuter dans Supabase SQL Editor

-- 1. Ajouter la colonne pour tracer l'origine de la facture
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS source_delivery_note_id UUID REFERENCES delivery_notes(id);

-- 2. Mettre à jour la fonction de calcul du solde client
-- Les factures issues d'un BL ne doivent PAS être comptées car le BL est déjà dans le solde
CREATE OR REPLACE FUNCTION calculate_customer_balance(target_customer_id UUID) 
RETURNS DECIMAL AS $$
DECLARE
    v_initial_balance DECIMAL := 0;
    v_total_invoiced DECIMAL := 0;
    v_total_bl DECIMAL := 0;
    v_total_inv_pay DECIMAL := 0;
    v_total_bl_pay DECIMAL := 0;
    v_total_global_pay DECIMAL := 0;
    v_balance_start_date DATE := NULL;
    v_new_balance DECIMAL := 0;
BEGIN
    -- 0. Get Initial Balance and Balance Start Date
    SELECT COALESCE(initial_balance, 0), balance_start_date 
    INTO v_initial_balance, v_balance_start_date
    FROM customers
    WHERE id = target_customer_id;

    -- 1. Sum Valid Invoices (Validated/Sent/Partial/Paid)
    -- IMPORTANT: Exclure les factures issues d'un BL (source_delivery_note_id IS NOT NULL)
    -- car le BL est déjà comptabilisé dans v_total_bl
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_total_invoiced
    FROM invoices 
    WHERE customer_id = target_customer_id 
      AND status NOT IN ('BROUILLON', 'ANNULEE')
      AND source_delivery_note_id IS NULL  -- ← Nouvelle condition
      AND (v_balance_start_date IS NULL OR invoice_date >= v_balance_start_date);

    -- 2. Sum Valid Delivery Notes (Delivered, Valued, Not Invoiced)
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_total_bl
    FROM delivery_notes 
    WHERE customer_id = target_customer_id 
      AND status = 'LIVRE' 
      AND (invoice_id IS NULL)
      AND (is_valued = true OR total_ttc > 0)
      AND (v_balance_start_date IS NULL OR delivery_date >= v_balance_start_date);

    -- 3. Sum Invoice Payments
    SELECT COALESCE(SUM(p.amount), 0) INTO v_total_inv_pay
    FROM invoice_payments p
    JOIN invoices i ON p.invoice_id = i.id
    WHERE i.customer_id = target_customer_id
      AND (v_balance_start_date IS NULL OR p.payment_date >= v_balance_start_date);

    -- 4. Sum BL Payments
    SELECT COALESCE(SUM(p.amount), 0) INTO v_total_bl_pay
    FROM delivery_note_payments p
    JOIN delivery_notes dn ON p.delivery_note_id = dn.id
    WHERE dn.customer_id = target_customer_id
      AND (v_balance_start_date IS NULL OR p.payment_date >= v_balance_start_date);

    -- 5. Sum Global Payments (if table exists)
    BEGIN
        SELECT COALESCE(SUM(amount), 0) INTO v_total_global_pay
        FROM global_payments
        WHERE customer_id = target_customer_id
          AND (v_balance_start_date IS NULL OR payment_date >= v_balance_start_date);
    EXCEPTION WHEN undefined_table THEN
        v_total_global_pay := 0;
    END;

    -- Formula: Initial + (Invoiced + BLs) - (InvPayments + BLPayments + GlobalPayments)
    v_new_balance := v_initial_balance + (v_total_invoiced + v_total_bl) - (v_total_inv_pay + v_total_bl_pay + v_total_global_pay);
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Force recalculation of all customer balances
UPDATE customers SET balance = calculate_customer_balance(id);

-- 4. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Vérification (optionnel)
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'invoices' AND column_name = 'source_delivery_note_id';
