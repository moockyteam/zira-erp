-- Fonction pour restaurer le stock lorsqu'une facture est annulée
-- Elle parcourt les lignes de la facture et crèe des mouvements de stock "IN" (Entrée/Retour)

CREATE OR REPLACE FUNCTION restore_stock_from_invoice(p_invoice_id UUID)
RETURNS VOID 
SECURITY DEFINER
AS $$
DECLARE
    v_line RECORD;
    v_company_id UUID;
BEGIN
    SELECT company_id INTO v_company_id FROM invoices WHERE id = p_invoice_id;

    -- Parcourir toutes les lignes de la facture
    FOR v_line IN 
        SELECT item_id, quantity 
        FROM invoice_lines 
        WHERE invoice_id = p_invoice_id 
        AND item_id IS NOT NULL  -- Ignorer les articles supprimés ou sans ID stock
    LOOP
        -- Ajouter un mouvement de stock "IN" (Retour de marchandise)
        -- On utilise INSERT directement ou via une fonction existante si dispo. 
        -- Ici on insère directement dans stock_movements pour être sûr.
        INSERT INTO stock_movements (
            item_id, 
            quantity, 
            movement_type, 
            notes,
            created_at,
            company_id
        ) VALUES (
            v_line.item_id,
            v_line.quantity, -- Quantité positive car c'est une entrée
            'ENTREE',
            'Annulation facture ' || p_invoice_id,
            NOW(),
            v_company_id
        );
        
        -- Note: Le trigger standard 'on_stock_movement_insert' devrait mettre à jour 'items.quantity_on_hand'
    END LOOP;
END;
$$ LANGUAGE plpgsql;
