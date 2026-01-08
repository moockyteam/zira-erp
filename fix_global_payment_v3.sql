-- =====================================================
-- FIX: Paiements Globaux avec Gestion des Crédits Client
-- Version 3.0 - Solution Complète et Sécurisée
-- =====================================================  
-- 
-- PROBLÈME RÉSOLU:
-- Quand un utilisateur saisit un paiement antidaté (ex: date=05/01 créé le 08/01),
-- et que d'autres paiements ont été faits entre-temps, l'excédent non-allouable était PERDU.
--
-- SOLUTION:
-- 1. Allouer sur les soldes ACTUELS (évite les surpaiements)
-- 2. Stocker l'excédent dans customer_credits (rien ne se perd)
-- 3. Le crédit peut être utilisé manuellement ou affiché dans le solde
-- =====================================================

-- 1. CRÉER LA TABLE customer_credits (si elle n'existe pas)
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(15,3) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL,
    notes TEXT,
    source_payment_id UUID, -- Pour tracer l'origine
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_customer_credits_customer_id ON customer_credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_credits_payment_date ON customer_credits(payment_date);

-- Activer RLS
ALTER TABLE customer_credits ENABLE ROW LEVEL SECURITY;

-- Politique RLS: accessible si on peut voir le client (via les RLS existantes sur customers)
DROP POLICY IF EXISTS "customer_credits_policy" ON customer_credits;
CREATE POLICY "customer_credits_policy" ON customer_credits
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM customers
            WHERE customers.id = customer_credits.customer_id
            -- Les customers ont déjà leurs propres politiques RLS basées sur company_id
        )
    );

-- =====================================================
-- 2. NOUVELLE FONCTION record_global_payment (V3)
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
    r_doc RECORD;
    v_payment_id UUID;
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

    -- =====================================================
    -- ALLOCATION FIFO (First In, First Out)
    -- On utilise les soldes ACTUELS pour éviter les surpaiements
    -- =====================================================
    FOR r_doc IN 
        (
            -- 1. Factures Impayées
            SELECT 
                i.id, 
                'INVOICE' as type, 
                i.invoice_date as doc_date, 
                i.invoice_number as reference,
                i.total_ttc,
                COALESCE(SUM(p.amount), 0) as paid_so_far,
                (i.total_ttc - COALESCE(SUM(p.amount), 0)) as balance
            FROM invoices i
            LEFT JOIN invoice_payments p ON i.id = p.invoice_id
            WHERE i.customer_id = p_customer_id
              AND i.status NOT IN ('BROUILLON', 'ANNULEE')
            GROUP BY i.id
            HAVING (i.total_ttc - COALESCE(SUM(p.amount), 0)) > 0.001

            UNION ALL

            -- 2. Bons de Livraison Impayés
            SELECT 
                dn.id, 
                'DELIVERY_NOTE' as type, 
                COALESCE(dn.delivery_date, dn.created_at)::date as doc_date, 
                dn.delivery_note_number as reference,
                dn.total_ttc,
                COALESCE(SUM(p.amount), 0) as paid_so_far,
                (dn.total_ttc - COALESCE(SUM(p.amount), 0)) as balance
            FROM delivery_notes dn
            LEFT JOIN delivery_note_payments p ON dn.id = p.delivery_note_id
            WHERE dn.customer_id = p_customer_id
              AND dn.status = 'LIVRE'
              AND dn.invoice_id IS NULL
              AND (dn.is_valued = true OR dn.total_ttc > 0)
            GROUP BY dn.id
            HAVING (dn.total_ttc - COALESCE(SUM(p.amount), 0)) > 0.001

            ORDER BY doc_date ASC -- FIFO: plus anciens d'abord
        )
    LOOP
        -- Sortir si plus de budget
        IF v_remaining_amount <= 0.001 THEN
            EXIT;
        END IF;

        -- Calculer le montant à payer sur ce document
        v_doc_balance := r_doc.balance;
        v_pay_amount := LEAST(v_remaining_amount, v_doc_balance);

        -- Insérer le paiement
        IF r_doc.type = 'INVOICE' THEN
            INSERT INTO invoice_payments (
                invoice_id, 
                amount, 
                payment_date, 
                payment_method, 
                notes
            ) VALUES (
                r_doc.id,
                v_pay_amount,
                p_date::TIMESTAMP,
                p_payment_method,
                COALESCE(p_notes, '') || ' (Alloc. Auto)'
            ) RETURNING id INTO v_payment_id;
            
        ELSIF r_doc.type = 'DELIVERY_NOTE' THEN
             INSERT INTO delivery_note_payments (
                delivery_note_id, 
                amount, 
                payment_date, 
                payment_method, 
                notes
            ) VALUES (
                r_doc.id,
                v_pay_amount,
                p_date::TIMESTAMP,
                p_payment_method,
                COALESCE(p_notes, '') || ' (Alloc. Auto)'
            ) RETURNING id INTO v_payment_id;
        END IF;

        -- Mettre à jour les compteurs
        v_remaining_amount := v_remaining_amount - v_pay_amount;
        v_allocated_amount := v_allocated_amount + v_pay_amount;

        -- Logger le résultat
        v_result := v_result || jsonb_build_object(
            'document_type', r_doc.type,
            'reference', r_doc.reference,
            'amount_paid', v_pay_amount
        );

    END LOOP;

    -- =====================================================
    -- NOUVEAU: Stocker l'excédent en crédit client
    -- =====================================================
    -- Arrondir pour éviter les erreurs de précision flottante
    v_remaining_amount := ROUND(v_remaining_amount, 3);
    
    IF v_remaining_amount > 0 THEN
        INSERT INTO customer_credits (
            customer_id,
            amount,
            payment_date,
            payment_method,
            notes
        ) VALUES (
            p_customer_id,
            v_remaining_amount,
            p_date,
            p_payment_method,
            COALESCE(p_notes, '') || ' (Crédit non-alloué)'
        ) RETURNING id INTO v_credit_id;
        
        v_credit_stored := v_remaining_amount;
    END IF;

    -- Retourner le résultat complet
    RETURN jsonb_build_object(
        'total_requested', p_amount,
        'total_allocated', v_allocated_amount,
        'total_credited', v_credit_stored,
        'remaining_unallocated', 0, -- Plus jamais de perte!
        'credit_id', v_credit_id,
        'allocations', v_result,
        'message', CASE 
            WHEN v_credit_stored > 0 THEN 
                'Paiement enregistré. ' || v_credit_stored::TEXT || ' TND stockés en crédit client (pas de dette disponible).'
            ELSE 
                'Paiement entièrement alloué aux documents.'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. METTRE À JOUR calculate_customer_balance pour inclure les crédits
-- =====================================================
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
    -- 0. Solde initial et date de départ
    SELECT COALESCE(initial_balance, 0), balance_start_date 
    INTO v_initial_balance, v_balance_start_date
    FROM customers
    WHERE id = p_customer_id;

    -- 1. Somme des factures valides (hors celles issues de BL pour éviter double comptage)
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_total_invoiced
    FROM invoices 
    WHERE customer_id = p_customer_id 
      AND status NOT IN ('BROUILLON', 'ANNULEE')
      AND source_delivery_note_id IS NULL 
      AND (v_balance_start_date IS NULL OR invoice_date >= v_balance_start_date);

    -- 2. Somme des BL livrés non facturés
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_total_bl
    FROM delivery_notes 
    WHERE customer_id = p_customer_id 
      AND status = 'LIVRE' 
      AND (invoice_id IS NULL)
      AND (is_valued = true OR total_ttc > 0)
      AND (v_balance_start_date IS NULL OR COALESCE(delivery_date, created_at)::date >= v_balance_start_date);

    -- 3. Somme des paiements sur factures
    SELECT COALESCE(SUM(p.amount), 0) INTO v_total_inv_pay
    FROM invoice_payments p
    JOIN invoices i ON p.invoice_id = i.id
    WHERE i.customer_id = p_customer_id
      AND (v_balance_start_date IS NULL OR p.payment_date >= v_balance_start_date);

    -- 4. Somme des paiements sur BL
    SELECT COALESCE(SUM(p.amount), 0) INTO v_total_bl_pay
    FROM delivery_note_payments p
    JOIN delivery_notes dn ON p.delivery_note_id = dn.id
    WHERE dn.customer_id = p_customer_id
      AND (v_balance_start_date IS NULL OR p.payment_date >= v_balance_start_date);

    -- 5. NOUVEAU: Somme des crédits client (avances non-allouées)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_credits
    FROM customer_credits
    WHERE customer_id = p_customer_id
      AND (v_balance_start_date IS NULL OR payment_date >= v_balance_start_date);

    -- Formule: Dette = Initial + Documents - Paiements - Crédits
    v_new_balance := v_initial_balance + (v_total_invoiced + v_total_bl) - (v_total_inv_pay + v_total_bl_pay + v_total_credits);
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. PERMISSIONS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_credits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_credits TO service_role;
GRANT EXECUTE ON FUNCTION record_global_payment(UUID, DECIMAL, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION record_global_payment(UUID, DECIMAL, TEXT, TEXT, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION calculate_customer_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_customer_balance(UUID) TO service_role;

-- =====================================================
-- 5. RECHARGER LE SCHÉMA
-- =====================================================
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- RÉSUMÉ DES CHANGEMENTS:
-- =====================================================
-- ✅ Table customer_credits créée pour stocker les avances/excédents
-- ✅ record_global_payment V3: stocke l'excédent au lieu de le perdre
-- ✅ calculate_customer_balance: inclut les crédits dans le calcul
-- ✅ Plus AUCUNE perte de montant!
-- 
-- COMPORTEMENT ATTENDU:
-- - Paiement 300 DT, dette disponible 284.865 DT
-- - 284.865 DT alloués aux documents
-- - 15.135 DT stockés en customer_credits
-- - Solde client réduit de 300 DT au total
-- =====================================================
