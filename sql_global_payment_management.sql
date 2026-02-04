-- ============================================================================
-- GLOBAL PAYMENT MANAGEMENT FUNCTIONS
-- ============================================================================
-- Ces fonctions permettent de supprimer et modifier les paiements globaux
-- tout en garantissant le recalcul automatique des soldes
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fonction: Supprimer un paiement global
-- ----------------------------------------------------------------------------
-- Cette fonction supprime un paiement spécifique et recalcule automatiquement
-- le solde client ainsi que le solde de la facture/BL concerné
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION delete_global_payment_allocation(
    p_payment_type TEXT,  -- 'INVOICE' ou 'DELIVERY_NOTE' ou 'CREDIT'
    p_payment_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_customer_id UUID;
    v_amount NUMERIC;
    v_document_id UUID;
    v_result JSON;
BEGIN
    -- Déterminer le type et récupérer les informations
    IF p_payment_type = 'INVOICE' THEN
        -- Récupérer les infos du paiement facture
        SELECT i.customer_id, ip.amount, ip.invoice_id 
        INTO v_customer_id, v_amount, v_document_id
        FROM invoice_payments ip
        JOIN invoices i ON ip.invoice_id = i.id
        WHERE ip.id = p_payment_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invoice payment not found: %', p_payment_id;
        END IF;
        
        -- Supprimer le paiement
        DELETE FROM invoice_payments WHERE id = p_payment_id;
        
        -- Recalculer le solde de la facture
        UPDATE invoices
        SET solde = total_ttc - COALESCE((
            SELECT SUM(amount) 
            FROM invoice_payments 
            WHERE invoice_id = v_document_id
        ), 0)
        WHERE id = v_document_id;
        
    ELSIF p_payment_type = 'DELIVERY_NOTE' THEN
        -- Récupérer les infos du paiement BL
        SELECT dn.customer_id, dnp.amount, dnp.delivery_note_id 
        INTO v_customer_id, v_amount, v_document_id
        FROM delivery_note_payments dnp
        JOIN delivery_notes dn ON dnp.delivery_note_id = dn.id
        WHERE dnp.id = p_payment_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Delivery note payment not found: %', p_payment_id;
        END IF;
        
        -- Supprimer le paiement
        DELETE FROM delivery_note_payments WHERE id = p_payment_id;
        
        -- Recalculer le solde du BL
        UPDATE delivery_notes
        SET solde = total_ttc - COALESCE((
            SELECT SUM(amount) 
            FROM delivery_note_payments 
            WHERE delivery_note_id = v_document_id
        ), 0)
        WHERE id = v_document_id;
        
    ELSIF p_payment_type = 'CREDIT' THEN
        -- Récupérer les infos du crédit
        SELECT customer_id, amount 
        INTO v_customer_id, v_amount
        FROM customer_credits
        WHERE id = p_payment_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Customer credit not found: %', p_payment_id;
        END IF;
        
        -- Supprimer le crédit
        DELETE FROM customer_credits WHERE id = p_payment_id;
        
    ELSE
        RAISE EXCEPTION 'Invalid payment type: %. Must be INVOICE, DELIVERY_NOTE, or CREDIT', p_payment_type;
    END IF;
    
    -- Recalculer le solde client
    UPDATE customers 
    SET balance = calculate_customer_balance(id)
    WHERE id = v_customer_id;
    
    -- Retourner le résultat
    v_result := json_build_object(
        'success', true,
        'customer_id', v_customer_id,
        'amount_refunded', v_amount,
        'new_balance', (SELECT balance FROM customers WHERE id = v_customer_id),
        'message', 'Paiement supprimé avec succès'
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. Fonction: Modifier le montant d'un paiement global
-- ----------------------------------------------------------------------------
-- Cette fonction modifie le montant d'un paiement et recalcule automatiquement
-- tous les soldes concernés
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_global_payment_amount(
    p_payment_type TEXT,
    p_payment_id UUID,
    p_new_amount NUMERIC
)
RETURNS JSON AS $$
DECLARE
    v_customer_id UUID;
    v_old_amount NUMERIC;
    v_document_id UUID;
    v_difference NUMERIC;
    v_result JSON;
BEGIN
    -- Vérifier que le nouveau montant est valide
    IF p_new_amount <= 0 THEN
        RAISE EXCEPTION 'Le montant doit être positif';
    END IF;
    
    -- Récupérer l'ancien montant et mettre à jour selon le type
    IF p_payment_type = 'INVOICE' THEN
        -- Récupérer les infos
        SELECT i.customer_id, ip.amount, ip.invoice_id 
        INTO v_customer_id, v_old_amount, v_document_id
        FROM invoice_payments ip
        JOIN invoices i ON ip.invoice_id = i.id
        WHERE ip.id = p_payment_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invoice payment not found: %', p_payment_id;
        END IF;
        
        -- Vérifier que le nouveau montant ne dépasse pas le total de la facture
        IF p_new_amount > (SELECT total_ttc FROM invoices WHERE id = v_document_id) THEN
            RAISE EXCEPTION 'Le montant du paiement ne peut pas dépasser le total de la facture';
        END IF;
        
        -- Mettre à jour le montant
        UPDATE invoice_payments 
        SET amount = p_new_amount
        WHERE id = p_payment_id;
        
        -- Recalculer le solde de la facture
        UPDATE invoices
        SET solde = total_ttc - COALESCE((
            SELECT SUM(amount) 
            FROM invoice_payments 
            WHERE invoice_id = v_document_id
        ), 0)
        WHERE id = v_document_id;
        
    ELSIF p_payment_type = 'DELIVERY_NOTE' THEN
        -- Récupérer les infos
        SELECT dn.customer_id, dnp.amount, dnp.delivery_note_id 
        INTO v_customer_id, v_old_amount, v_document_id
        FROM delivery_note_payments dnp
        JOIN delivery_notes dn ON dnp.delivery_note_id = dn.id
        WHERE dnp.id = p_payment_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Delivery note payment not found: %', p_payment_id;
        END IF;
        
        -- Vérifier que le nouveau montant ne dépasse pas le total du BL
        IF p_new_amount > (SELECT total_ttc FROM delivery_notes WHERE id = v_document_id) THEN
            RAISE EXCEPTION 'Le montant du paiement ne peut pas dépasser le total du BL';
        END IF;
        
        -- Mettre à jour le montant
        UPDATE delivery_note_payments 
        SET amount = p_new_amount
        WHERE id = p_payment_id;
        
        -- Recalculer le solde du BL
        UPDATE delivery_notes
        SET solde = total_ttc - COALESCE((
            SELECT SUM(amount) 
            FROM delivery_note_payments 
            WHERE delivery_note_id = v_document_id
        ), 0)
        WHERE id = v_document_id;
        
    ELSIF p_payment_type = 'CREDIT' THEN
        -- Récupérer les infos
        SELECT customer_id, amount 
        INTO v_customer_id, v_old_amount
        FROM customer_credits
        WHERE id = p_payment_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Customer credit not found: %', p_payment_id;
        END IF;
        
        -- Mettre à jour le montant
        UPDATE customer_credits 
        SET amount = p_new_amount
        WHERE id = p_payment_id;
        
    ELSE
        RAISE EXCEPTION 'Invalid payment type: %. Must be INVOICE, DELIVERY_NOTE, or CREDIT', p_payment_type;
    END IF;
    
    v_difference := p_new_amount - v_old_amount;
    
    -- Recalculer le solde client
    UPDATE customers 
    SET balance = calculate_customer_balance(id)
    WHERE id = v_customer_id;
    
    -- Retourner le résultat
    v_result := json_build_object(
        'success', true,
        'customer_id', v_customer_id,
        'old_amount', v_old_amount,
        'new_amount', p_new_amount,
        'difference', v_difference,
        'new_balance', (SELECT balance FROM customers WHERE id = v_customer_id),
        'message', 'Paiement modifié avec succès'
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3. Fonction: Obtenir les détails d'un paiement
-- ----------------------------------------------------------------------------
-- Fonction utilitaire pour récupérer les informations d'un paiement
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_payment_details(
    p_payment_type TEXT,
    p_payment_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    IF p_payment_type = 'INVOICE' THEN
        SELECT json_build_object(
            'id', ip.id,
            'amount', ip.amount,
            'payment_date', ip.payment_date,
            'payment_method', ip.payment_method,
            'notes', ip.notes,
            'customer_id', i.customer_id,
            'customer_name', c.name,
            'document_id', i.id,
            'document_number', i.invoice_number,
            'document_total', i.total_ttc,
            'document_solde', i.solde
        ) INTO v_result
        FROM invoice_payments ip
        JOIN invoices i ON ip.invoice_id = i.id
        JOIN customers c ON i.customer_id = c.id
        WHERE ip.id = p_payment_id;
        
    ELSIF p_payment_type = 'DELIVERY_NOTE' THEN
        SELECT json_build_object(
            'id', dnp.id,
            'amount', dnp.amount,
            'payment_date', dnp.payment_date,
            'payment_method', dnp.payment_method,
            'notes', dnp.notes,
            'customer_id', dn.customer_id,
            'customer_name', c.name,
            'document_id', dn.id,
            'document_number', dn.delivery_note_number,
            'document_total', dn.total_ttc,
            'document_solde', dn.solde
        ) INTO v_result
        FROM delivery_note_payments dnp
        JOIN delivery_notes dn ON dnp.delivery_note_id = dn.id
        JOIN customers c ON dn.customer_id = c.id
        WHERE dnp.id = p_payment_id;
        
    ELSIF p_payment_type = 'CREDIT' THEN
        SELECT json_build_object(
            'id', cc.id,
            'amount', cc.amount,
            'created_at', cc.created_at,
            'notes', cc.notes,
            'customer_id', cc.customer_id,
            'customer_name', c.name
        ) INTO v_result
        FROM customer_credits cc
        JOIN customers c ON cc.customer_id = c.id
        WHERE cc.id = p_payment_id;
        
    ELSE
        RAISE EXCEPTION 'Invalid payment type: %', p_payment_type;
    END IF;
    
    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Payment not found';
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIN DES FONCTIONS
-- ============================================================================

COMMENT ON FUNCTION delete_global_payment_allocation IS 'Supprime un paiement global et recalcule automatiquement les soldes';
COMMENT ON FUNCTION update_global_payment_amount IS 'Modifie le montant d''un paiement global et recalcule les soldes';
COMMENT ON FUNCTION get_payment_details IS 'Récupère les détails d''un paiement pour affichage';
