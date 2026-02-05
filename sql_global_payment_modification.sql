-- ============================================================================
-- GLOBAL PAYMENT MODIFICATION FUNCTIONS
-- ============================================================================
-- Ces fonctions permettent de modifier ou supprimer un paiement global complet
-- avec réallocation automatique sur les documents non soldés
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fonction auxiliaire: Récupérer les allocations d'un paiement global
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_global_payment_allocations(p_global_payment_id UUID)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'invoice_payments', COALESCE((
            SELECT json_agg(json_build_object(
                'id', ip.id,
                'invoice_id', ip.invoice_id,
                'amount', ip.amount
            ))
            FROM invoice_payments ip
            WHERE ip.global_payment_id = p_global_payment_id
        ), '[]'::json),
        'delivery_note_payments', COALESCE((
            SELECT json_agg(json_build_object(
                'id', dnp.id,
                'delivery_note_id', dnp.delivery_note_id,
                'amount', dnp.amount
            ))
            FROM delivery_note_payments dnp
            WHERE dnp.global_payment_id = p_global_payment_id
        ), '[]'::json),
        'credits', COALESCE((
            SELECT json_agg(json_build_object(
                'id', cc.id,
                'amount', cc.amount
            ))
            FROM customer_credits cc
            WHERE cc.global_payment_id = p_global_payment_id
        ), '[]'::json)
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. Fonction: Supprimer un paiement global et ses allocations
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_global_payment(p_global_payment_id UUID)
RETURNS JSON AS $$
DECLARE
    v_customer_id UUID;
    v_amount NUMERIC;
    v_invoice_ids UUID[];
    v_bl_ids UUID[];
    v_result JSON;
BEGIN
    -- 1. Récupérer les informations du paiement global
    SELECT customer_id, amount INTO v_customer_id, v_amount
    FROM global_payment_entries
    WHERE id = p_global_payment_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paiement global non trouvé: %', p_global_payment_id;
    END IF;
    
    -- 2. Récupérer les IDs des documents affectés AVANT suppression
    SELECT ARRAY_AGG(DISTINCT invoice_id) INTO v_invoice_ids
    FROM invoice_payments
    WHERE global_payment_id = p_global_payment_id;
    
    SELECT ARRAY_AGG(DISTINCT delivery_note_id) INTO v_bl_ids
    FROM delivery_note_payments
    WHERE global_payment_id = p_global_payment_id;
    
    -- 3. Supprimer les allocations sur factures
    DELETE FROM invoice_payments WHERE global_payment_id = p_global_payment_id;
    
    -- 4. Supprimer les allocations sur BLs
    DELETE FROM delivery_note_payments WHERE global_payment_id = p_global_payment_id;
    
    -- 5. Supprimer les crédits créés par ce paiement (si lien existe)
    DELETE FROM customer_credits WHERE global_payment_id = p_global_payment_id;
    
    -- 6. Supprimer l'entrée du paiement global
    DELETE FROM global_payment_entries WHERE id = p_global_payment_id;
    
    -- 7. Recalculer les soldes des factures affectées
    IF v_invoice_ids IS NOT NULL THEN
        UPDATE invoices
        SET solde = total_ttc - COALESCE((
            SELECT SUM(amount) FROM invoice_payments WHERE invoice_id = invoices.id
        ), 0)
        WHERE id = ANY(v_invoice_ids);
    END IF;
    
    -- 8. Recalculer les soldes des BLs affectés
    IF v_bl_ids IS NOT NULL THEN
        UPDATE delivery_notes
        SET solde = total_ttc - COALESCE((
            SELECT SUM(amount) FROM delivery_note_payments WHERE delivery_note_id = delivery_notes.id
        ), 0)
        WHERE id = ANY(v_bl_ids);
    END IF;
    
    -- 9. Recalculer le solde client
    UPDATE customers 
    SET balance = calculate_customer_balance(id)
    WHERE id = v_customer_id;
    
    -- 10. Retourner le résultat
    v_result := json_build_object(
        'success', true,
        'customer_id', v_customer_id,
        'deleted_amount', v_amount,
        'new_balance', (SELECT balance FROM customers WHERE id = v_customer_id),
        'invoices_affected', COALESCE(array_length(v_invoice_ids, 1), 0),
        'bls_affected', COALESCE(array_length(v_bl_ids, 1), 0),
        'message', 'Paiement global supprimé avec succès'
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3. Fonction: Modifier le montant d'un paiement global avec réallocation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_global_payment(
    p_global_payment_id UUID,
    p_new_amount NUMERIC
)
RETURNS JSON AS $$
DECLARE
    v_customer_id UUID;
    v_old_amount NUMERIC;
    v_payment_method TEXT;
    v_payment_date DATE;
    v_notes TEXT;
    v_invoice_ids UUID[];
    v_bl_ids UUID[];
    v_remaining NUMERIC;
    v_doc RECORD;
    v_allocation NUMERIC;
    v_result JSON;
BEGIN
    -- Validation
    IF p_new_amount <= 0 THEN
        RAISE EXCEPTION 'Le montant doit être positif';
    END IF;
    
    -- 1. Récupérer les infos du paiement global existant
    SELECT customer_id, amount, payment_method, payment_date, notes 
    INTO v_customer_id, v_old_amount, v_payment_method, v_payment_date, v_notes
    FROM global_payment_entries
    WHERE id = p_global_payment_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paiement global non trouvé: %', p_global_payment_id;
    END IF;
    
    -- 2. Récupérer les IDs des documents affectés AVANT suppression
    SELECT ARRAY_AGG(DISTINCT invoice_id) INTO v_invoice_ids
    FROM invoice_payments
    WHERE global_payment_id = p_global_payment_id;
    
    SELECT ARRAY_AGG(DISTINCT delivery_note_id) INTO v_bl_ids
    FROM delivery_note_payments
    WHERE global_payment_id = p_global_payment_id;
    
    -- 3. Supprimer TOUTES les anciennes allocations
    DELETE FROM invoice_payments WHERE global_payment_id = p_global_payment_id;
    DELETE FROM delivery_note_payments WHERE global_payment_id = p_global_payment_id;
    DELETE FROM customer_credits WHERE global_payment_id = p_global_payment_id;
    
    -- 4. Mettre à jour le montant du paiement global
    UPDATE global_payment_entries
    SET amount = p_new_amount
    WHERE id = p_global_payment_id;
    
    -- 5. Recalculer les soldes des documents qui étaient liés (avant réallocation)
    IF v_invoice_ids IS NOT NULL THEN
        UPDATE invoices
        SET solde = total_ttc - COALESCE((
            SELECT SUM(amount) FROM invoice_payments WHERE invoice_id = invoices.id
        ), 0)
        WHERE id = ANY(v_invoice_ids);
    END IF;
    
    IF v_bl_ids IS NOT NULL THEN
        UPDATE delivery_notes
        SET solde = total_ttc - COALESCE((
            SELECT SUM(amount) FROM delivery_note_payments WHERE delivery_note_id = delivery_notes.id
        ), 0)
        WHERE id = ANY(v_bl_ids);
    END IF;
    
    -- 6. RÉALLOCATION: appliquer le nouveau montant sur les documents non soldés
    v_remaining := p_new_amount;
    
    -- 6.1 Allouer sur les FACTURES non soldées (les plus anciennes d'abord)
    FOR v_doc IN 
        SELECT id, solde, invoice_number
        FROM invoices 
        WHERE customer_id = v_customer_id 
        AND status NOT IN ('BROUILLON', 'ANNULEE')
        AND solde > 0
        ORDER BY invoice_date ASC, created_at ASC
    LOOP
        EXIT WHEN v_remaining <= 0;
        
        v_allocation := LEAST(v_remaining, v_doc.solde);
        
        INSERT INTO invoice_payments (
            invoice_id, amount, payment_date, payment_method, notes, global_payment_id
        ) VALUES (
            v_doc.id, v_allocation, v_payment_date, v_payment_method, 
            COALESCE(v_notes, '') || ' [Réallocation]', p_global_payment_id
        );
        
        -- Mettre à jour le solde de la facture
        UPDATE invoices SET solde = solde - v_allocation WHERE id = v_doc.id;
        
        v_remaining := v_remaining - v_allocation;
    END LOOP;
    
    -- 6.2 Allouer sur les BLs non facturés et non soldés
    FOR v_doc IN 
        SELECT id, solde, delivery_note_number
        FROM delivery_notes 
        WHERE customer_id = v_customer_id 
        AND status = 'LIVRE'
        AND invoice_id IS NULL
        AND solde > 0
        ORDER BY delivery_date ASC, created_at ASC
    LOOP
        EXIT WHEN v_remaining <= 0;
        
        v_allocation := LEAST(v_remaining, v_doc.solde);
        
        INSERT INTO delivery_note_payments (
            delivery_note_id, amount, payment_date, payment_method, notes, global_payment_id
        ) VALUES (
            v_doc.id, v_allocation, v_payment_date, v_payment_method, 
            COALESCE(v_notes, '') || ' [Réallocation]', p_global_payment_id
        );
        
        -- Mettre à jour le solde du BL
        UPDATE delivery_notes SET solde = solde - v_allocation WHERE id = v_doc.id;
        
        v_remaining := v_remaining - v_allocation;
    END LOOP;
    
    -- 6.3 Si surplus, créer un crédit client
    IF v_remaining > 0 THEN
        INSERT INTO customer_credits (
            customer_id, amount, payment_method, payment_date, notes, global_payment_id
        ) VALUES (
            v_customer_id, v_remaining, v_payment_method, v_payment_date,
            'Avance - surplus paiement global [Réallocation]', p_global_payment_id
        );
    END IF;
    
    -- 7. Recalculer le solde client
    UPDATE customers 
    SET balance = calculate_customer_balance(id)
    WHERE id = v_customer_id;
    
    -- 8. Retourner le résultat
    v_result := json_build_object(
        'success', true,
        'customer_id', v_customer_id,
        'old_amount', v_old_amount,
        'new_amount', p_new_amount,
        'difference', p_new_amount - v_old_amount,
        'new_balance', (SELECT balance FROM customers WHERE id = v_customer_id),
        'credit_created', CASE WHEN v_remaining > 0 THEN v_remaining ELSE 0 END,
        'message', 'Paiement global modifié et réalloué avec succès'
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 4. Fonction: Lister les paiements globaux d'un client
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_customer_global_payments(p_customer_id UUID)
RETURNS JSON AS $$
BEGIN
    RETURN COALESCE((
        SELECT json_agg(json_build_object(
            'id', gpe.id,
            'amount', gpe.amount,
            'payment_date', gpe.payment_date,
            'payment_method', gpe.payment_method,
            'notes', gpe.notes,
            'created_at', gpe.created_at,
            'allocations', (
                SELECT json_build_object(
                    'invoices', COALESCE((
                        SELECT json_agg(json_build_object(
                            'invoice_number', i.invoice_number,
                            'amount', ip.amount
                        ))
                        FROM invoice_payments ip
                        JOIN invoices i ON ip.invoice_id = i.id
                        WHERE ip.global_payment_id = gpe.id
                    ), '[]'::json),
                    'bls', COALESCE((
                        SELECT json_agg(json_build_object(
                            'delivery_note_number', dn.delivery_note_number,
                            'amount', dnp.amount
                        ))
                        FROM delivery_note_payments dnp
                        JOIN delivery_notes dn ON dnp.delivery_note_id = dn.id
                        WHERE dnp.global_payment_id = gpe.id
                    ), '[]'::json),
                    'credits', COALESCE((
                        SELECT SUM(amount)
                        FROM customer_credits cc
                        WHERE cc.global_payment_id = gpe.id
                    ), 0)
                )
            )
        ) ORDER BY gpe.payment_date DESC, gpe.created_at DESC)
        FROM global_payment_entries gpe
        WHERE gpe.customer_id = p_customer_id
    ), '[]'::json);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION delete_global_payment IS 'Supprime un paiement global et toutes ses allocations, recalcule les soldes';
COMMENT ON FUNCTION update_global_payment IS 'Modifie le montant d''un paiement global et réalloue automatiquement sur les documents';
COMMENT ON FUNCTION get_customer_global_payments IS 'Récupère la liste des paiements globaux d''un client avec leurs allocations';
COMMENT ON FUNCTION get_global_payment_allocations IS 'Récupère les détails d''allocation d''un paiement global spécifique';
