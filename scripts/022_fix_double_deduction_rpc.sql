-- Mise à jour de la fonction de déduction pour utiliser stock_movements (plus propre et traçable)
-- Cela remplace la logique de mise à jour directe "UPDATE items..." qui était invisible.

CREATE OR REPLACE FUNCTION deduct_stock_from_delivery_note(p_dn_id UUID)
RETURNS VOID 
SECURITY DEFINER
AS $$
DECLARE
    v_line RECORD;
    v_company_id UUID;
BEGIN
    -- Récupérer le company_id
    SELECT company_id INTO v_company_id FROM delivery_notes WHERE id = p_dn_id;

    -- Parcourir chaque ligne du bon de livraison
    FOR v_line IN
        SELECT item_id, quantity
        FROM delivery_note_lines
        WHERE delivery_note_id = p_dn_id AND item_id IS NOT NULL
    LOOP
        -- Au lieu de UPDATE items directement, on crée un mouvement de stock
        -- Le trigger existant sur stock_movements se chargera de mettre à jour items.quantity_on_hand
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
            'SORTIE', 
            'Validation BL ' || p_dn_id,
            NOW(),
            v_company_id
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;
