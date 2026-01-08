-- =====================================================
-- FIX V4: Réduction directe de initial_balance
-- =====================================================
-- 
-- LOGIQUE CORRIGÉE:
-- 1. D'abord allouer aux factures/BL impayés
-- 2. Si reste du montant ET initial_balance > 0 : réduire initial_balance
-- 3. Crédit UNIQUEMENT si solde devient négatif (avance client)
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

    -- Arrondir pour éviter les erreurs de précision
    v_remaining_amount := ROUND(v_remaining_amount, 3);

    -- =====================================================
    -- ÉTAPE 2: Réduire initial_balance si reste du montant
    -- =====================================================
    IF v_remaining_amount > 0 AND v_current_initial_balance > 0 THEN
        -- Calculer combien on peut réduire de l'initial_balance
        v_initial_balance_reduced := LEAST(v_remaining_amount, v_current_initial_balance);
        
        -- Mettre à jour initial_balance du client
        UPDATE customers 
        SET initial_balance = initial_balance - v_initial_balance_reduced
        WHERE id = p_customer_id;
        
        v_remaining_amount := v_remaining_amount - v_initial_balance_reduced;
        v_remaining_amount := ROUND(v_remaining_amount, 3);
        
        -- Ajouter au résultat
        v_result := v_result || jsonb_build_object(
            'document_type', 'INITIAL_BALANCE',
            'reference', 'Solde Initial',
            'amount_paid', v_initial_balance_reduced
        );
    END IF;

    -- =====================================================
    -- ÉTAPE 3: Crédit UNIQUEMENT si reste après tout
    -- (= le client a payé plus que sa dette totale)
    -- =====================================================
    IF v_remaining_amount > 0 THEN
        INSERT INTO customer_credits (customer_id, amount, payment_date, payment_method, notes)
        VALUES (p_customer_id, v_remaining_amount, p_date, p_payment_method, COALESCE(p_notes, '') || ' (Avance client)')
        RETURNING id INTO v_credit_id;
        v_credit_stored := v_remaining_amount;
    END IF;

    -- Retourner le résultat complet
    RETURN jsonb_build_object(
        'total_requested', p_amount,
        'total_allocated', v_allocated_amount,
        'initial_balance_reduced', v_initial_balance_reduced,
        'total_credited', v_credit_stored,
        'remaining_unallocated', 0,
        'credit_id', v_credit_id,
        'allocations', v_result,
        'message', CASE 
            WHEN v_credit_stored > 0 THEN 
                'Paiement enregistré. ' || v_credit_stored::TEXT || ' TND en avance client (solde était déjà nul).'
            WHEN v_initial_balance_reduced > 0 THEN
                'Paiement enregistré. ' || v_initial_balance_reduced::TEXT || ' TND déduits du solde initial.'
            ELSE 
                'Paiement entièrement alloué aux documents.'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recharger le schéma
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- COMPORTEMENT ATTENDU:
-- =====================================================
-- Client avec initial_balance = 2631, pas de BL/factures impayés
-- Paiement de 300 DT:
--   1. Pas de documents à payer → 0 alloué
--   2. initial_balance > 0 → réduire de 300
--   3. Nouveau initial_balance = 2331
--   4. Pas de crédit (solde encore positif)
-- =====================================================
