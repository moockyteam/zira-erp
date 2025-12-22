-- Fonction pour restaurer le stock lorsqu'un bon de livraison est annulé
-- Elle parcourt les lignes du BL et crée des mouvements de stock "ENTREE" (Retour)

CREATE OR REPLACE FUNCTION restore_stock_from_delivery_note(p_dn_id UUID)
RETURNS VOID 
SECURITY DEFINER
AS $$
DECLARE
    v_line RECORD;
    v_company_id UUID;
BEGIN
    -- Récupérer le company_id du BL
    SELECT company_id INTO v_company_id FROM delivery_notes WHERE id = p_dn_id;

    -- Parcourir toutes les lignes du BL
    FOR v_line IN 
        SELECT item_id, quantity 
        FROM delivery_note_lines 
        WHERE delivery_note_id = p_dn_id 
        AND item_id IS NOT NULL 
    LOOP
        INSERT INTO stock_movements (
            item_id, 
            quantity, 
            movement_type, 
            notes,
            created_at,
            company_id
        ) VALUES (
            v_line.item_id,
            v_line.quantity, 
            'ENTREE', 
            'Annulation BL ' || p_dn_id,
            NOW(),
            v_company_id
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;
