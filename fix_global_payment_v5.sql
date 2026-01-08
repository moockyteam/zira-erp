-- =====================================================
-- FIX V5: Stockage des Paiements Globaux avec Vue Simplifiée
-- =====================================================
--
-- OBJECTIF:
-- - Stocker chaque paiement global tel qu'il est saisi
-- - Afficher les montants réels dans "Encaissement Global"
-- - Plus de confusion entre montant saisi et montant alloué
-- =====================================================

-- 1. TABLE: global_payment_entries
-- Stocke chaque paiement global tel qu'il est saisi par l'utilisateur
-- =====================================================
CREATE TABLE IF NOT EXISTS global_payment_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(15,3) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL,
    notes TEXT,
    
    -- Détails de l'allocation (pour référence)
    amount_allocated DECIMAL(15,3) DEFAULT 0,
    amount_to_initial_balance DECIMAL(15,3) DEFAULT 0,
    amount_credited DECIMAL(15,3) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_global_payment_entries_customer ON global_payment_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_global_payment_entries_date ON global_payment_entries(payment_date);

-- RLS
ALTER TABLE global_payment_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "global_payment_entries_policy" ON global_payment_entries;
CREATE POLICY "global_payment_entries_policy" ON global_payment_entries
    FOR ALL USING (
        EXISTS (SELECT 1 FROM customers WHERE customers.id = global_payment_entries.customer_id)
    );

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON global_payment_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON global_payment_entries TO service_role;

-- =====================================================
-- 2. NOUVELLE FONCTION record_global_payment (V5)
-- Stocke le paiement dans global_payment_entries + fait l'allocation
-- =====================================================
CREATE OR REPLACE FUNCTION record_global_payment(
    p_customer_id UUID,
    p_amount DECIMAL,
    p_payment_method TEXT,
    p_notes TEXT,
    p_date DATE DEFAULT CURRENT_DATE
) 
RETURNS JSONB AS $$
DECLARE
    v_remaining_amount DECIMAL := p_amount;
    v_allocated_amount DECIMAL := 0;
    v_pay_amount DECIMAL := 0;
    v_doc_balance DECIMAL := 0;
    v_current_initial_balance DECIMAL := 0;
    v_initial_balance_reduced DECIMAL := 0;
    r_doc RECORD;
    v_payment_id UUID;
    v_entry_id UUID;
    v_credit_id UUID;
    v_result JSONB := '[]';
    v_credit_stored DECIMAL := 0;
BEGIN
    -- Validation
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Le montant doit être positif';
    END IF;

    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer ID requis';
    END IF;

    -- Récupérer initial_balance actuel
    SELECT COALESCE(initial_balance, 0) INTO v_current_initial_balance
    FROM customers WHERE id = p_customer_id;

    -- =====================================================
    -- ÉTAPE 1: Allouer aux Factures/BL (FIFO)
    -- =====================================================
    FOR r_doc IN 
        (
            SELECT i.id, 'INVOICE' as type, i.invoice_date as doc_date, i.invoice_number as reference,
                i.total_ttc, COALESCE(SUM(p.amount), 0) as paid_so_far,
                (i.total_ttc - COALESCE(SUM(p.amount), 0)) as balance
            FROM invoices i
            LEFT JOIN invoice_payments p ON i.id = p.invoice_id
            WHERE i.customer_id = p_customer_id AND i.status NOT IN ('BROUILLON', 'ANNULEE')
            GROUP BY i.id
            HAVING (i.total_ttc - COALESCE(SUM(p.amount), 0)) > 0.001

            UNION ALL

            SELECT dn.id, 'DELIVERY_NOTE' as type, COALESCE(dn.delivery_date, dn.created_at)::date as doc_date,
                dn.delivery_note_number as reference, dn.total_ttc, COALESCE(SUM(p.amount), 0) as paid_so_far,
                (dn.total_ttc - COALESCE(SUM(p.amount), 0)) as balance
            FROM delivery_notes dn
            LEFT JOIN delivery_note_payments p ON dn.id = p.delivery_note_id
            WHERE dn.customer_id = p_customer_id AND dn.status = 'LIVRE' AND dn.invoice_id IS NULL
              AND (dn.is_valued = true OR dn.total_ttc > 0)
            GROUP BY dn.id
            HAVING (dn.total_ttc - COALESCE(SUM(p.amount), 0)) > 0.001

            ORDER BY doc_date ASC
        )
    LOOP
        IF v_remaining_amount <= 0.001 THEN EXIT; END IF;

        v_doc_balance := r_doc.balance;
        v_pay_amount := LEAST(v_remaining_amount, v_doc_balance);

        IF r_doc.type = 'INVOICE' THEN
            INSERT INTO invoice_payments (invoice_id, amount, payment_date, payment_method, notes)
            VALUES (r_doc.id, v_pay_amount, p_date::TIMESTAMP, p_payment_method, COALESCE(p_notes, '') || ' (Alloc. Auto)')
            RETURNING id INTO v_payment_id;
        ELSIF r_doc.type = 'DELIVERY_NOTE' THEN
            INSERT INTO delivery_note_payments (delivery_note_id, amount, payment_date, payment_method, notes)
            VALUES (r_doc.id, v_pay_amount, p_date::TIMESTAMP, p_payment_method, COALESCE(p_notes, '') || ' (Alloc. Auto)')
            RETURNING id INTO v_payment_id;
        END IF;

        v_remaining_amount := v_remaining_amount - v_pay_amount;
        v_allocated_amount := v_allocated_amount + v_pay_amount;

        v_result := v_result || jsonb_build_object('document_type', r_doc.type, 'reference', r_doc.reference, 'amount_paid', v_pay_amount);
    END LOOP;

    v_remaining_amount := ROUND(v_remaining_amount, 3);

    -- =====================================================
    -- ÉTAPE 2: Réduire initial_balance si reste du montant
    -- =====================================================
    IF v_remaining_amount > 0 AND v_current_initial_balance > 0 THEN
        v_initial_balance_reduced := LEAST(v_remaining_amount, v_current_initial_balance);
        
        UPDATE customers 
        SET initial_balance = initial_balance - v_initial_balance_reduced
        WHERE id = p_customer_id;
        
        v_remaining_amount := ROUND(v_remaining_amount - v_initial_balance_reduced, 3);
        
        v_result := v_result || jsonb_build_object(
            'document_type', 'INITIAL_BALANCE',
            'reference', 'Solde Initial',
            'amount_paid', v_initial_balance_reduced
        );
    END IF;

    -- =====================================================
    -- ÉTAPE 3: Crédit si solde dépasse la dette totale
    -- =====================================================
    IF v_remaining_amount > 0 THEN
        INSERT INTO customer_credits (customer_id, amount, payment_date, payment_method, notes)
        VALUES (p_customer_id, v_remaining_amount, p_date, p_payment_method, COALESCE(p_notes, '') || ' (Avance client)')
        RETURNING id INTO v_credit_id;
        v_credit_stored := v_remaining_amount;
    END IF;

    -- =====================================================
    -- ÉTAPE 4: NOUVEAU - Stocker l'entrée de paiement global
    -- (C'est ce qui sera affiché dans "Encaissement Global")
    -- =====================================================
    INSERT INTO global_payment_entries (
        customer_id,
        amount,
        payment_date,
        payment_method,
        notes,
        amount_allocated,
        amount_to_initial_balance,
        amount_credited
    ) VALUES (
        p_customer_id,
        p_amount,  -- LE MONTANT RÉELLEMENT SAISI
        p_date,
        p_payment_method,
        p_notes,
        v_allocated_amount,
        v_initial_balance_reduced,
        v_credit_stored
    ) RETURNING id INTO v_entry_id;

    -- Retourner le résultat
    RETURN jsonb_build_object(
        'entry_id', v_entry_id,
        'total_requested', p_amount,
        'total_allocated', v_allocated_amount,
        'initial_balance_reduced', v_initial_balance_reduced,
        'total_credited', v_credit_stored,
        'remaining_unallocated', 0,
        'allocations', v_result,
        'message', CASE 
            WHEN v_credit_stored > 0 THEN 'Avance client de ' || v_credit_stored::TEXT || ' TND stockée.'
            WHEN v_initial_balance_reduced > 0 AND v_allocated_amount = 0 THEN 'Déduit du solde initial.'
            WHEN v_initial_balance_reduced > 0 THEN 'Alloué aux documents + déduit du solde initial.'
            ELSE 'Paiement entièrement alloué aux documents.'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recharger le schéma
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- 3. VUE: get_customer_global_payments
-- Pour afficher facilement les paiements dans l'UI
-- =====================================================
CREATE OR REPLACE FUNCTION get_customer_global_payments(p_customer_id UUID)
RETURNS TABLE (
    id UUID,
    payment_date DATE,
    amount DECIMAL,
    payment_method TEXT,
    notes TEXT,
    amount_allocated DECIMAL,
    amount_to_initial_balance DECIMAL,
    amount_credited DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gpe.id,
        gpe.payment_date,
        gpe.amount,
        gpe.payment_method,
        gpe.notes,
        gpe.amount_allocated,
        gpe.amount_to_initial_balance,
        gpe.amount_credited,
        gpe.created_at
    FROM global_payment_entries gpe
    WHERE gpe.customer_id = p_customer_id
    ORDER BY gpe.payment_date DESC, gpe.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_customer_global_payments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_global_payments(UUID) TO service_role;

-- =====================================================
-- RÉSULTAT ATTENDU:
-- =====================================================
-- Vous saisissez 300 DT → 300 DT affiché dans Encaissement Global
-- L'allocation se fait en arrière-plan mais n'affecte pas l'affichage
-- Vision claire et simple des paiements globaux
-- =====================================================
