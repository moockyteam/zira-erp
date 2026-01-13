-- FIXED: Remove direct quantity updates - let the trigger handle it
-- The trigger on_stock_movement_insert already updates quantity_on_hand

CREATE OR REPLACE FUNCTION perform_product_assembly(
    p_company_id UUID,
    p_item_id UUID,
    p_quantity_to_produce NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_bom_record RECORD;
    v_current_stock NUMERIC;
    v_required_qty NUMERIC;
    v_component_cost NUMERIC := 0;
    v_total_cost NUMERIC := 0;
    v_new_stock_id UUID;
    v_item_name TEXT;
BEGIN
    -- 1. Validate inputs
    IF p_quantity_to_produce <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'La quantité à produire doit être positive.');
    END IF;

    -- Get item name for better error messages
    SELECT name INTO v_item_name FROM items WHERE id = p_item_id;

    -- 2. Check Stock Availability for ALL ingredients first
    FOR v_bom_record IN 
        SELECT b.child_item_id, b.quantity, i.name, i.quantity_on_hand, i.default_purchase_price
        FROM bill_of_materials b
        JOIN items i ON i.id = b.child_item_id
        WHERE b.parent_item_id = p_item_id
    LOOP
        v_required_qty := v_bom_record.quantity * p_quantity_to_produce;
        
        IF v_bom_record.quantity_on_hand < v_required_qty THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', format('Stock insuffisant pour composant "%s". Requis: %s, Dispo: %s', v_bom_record.name, v_required_qty, v_bom_record.quantity_on_hand)
            );
        END IF;

        -- Accumulate estimated cost (using default purchase price of components)
        v_component_cost := COALESCE(v_bom_record.default_purchase_price, 0) * v_required_qty;
        v_total_cost := v_total_cost + v_component_cost;
    END LOOP;

    -- 3. If we are here, stock is sufficient. Proceed with updates.
    
    -- A. Deduct Components - ONLY INSERT MOVEMENTS, trigger will update quantity_on_hand
    FOR v_bom_record IN 
        SELECT b.child_item_id, b.quantity, i.default_purchase_price
        FROM bill_of_materials b
        JOIN items i ON i.id = b.child_item_id
        WHERE b.parent_item_id = p_item_id
    LOOP
        v_required_qty := v_bom_record.quantity * p_quantity_to_produce;

        -- REMOVED: Direct update of quantity_on_hand (trigger handles this)
        -- UPDATE items 
        -- SET quantity_on_hand = quantity_on_hand - v_required_qty
        -- WHERE id = v_bom_record.child_item_id;

        -- Insert SORTIE movement - trigger will deduct stock
        INSERT INTO stock_movements (
            company_id, 
            item_id, 
            movement_type, 
            quantity, 
            unit_price, 
            notes, 
            created_at
        ) VALUES (
            p_company_id,
            v_bom_record.child_item_id,
            'SORTIE',
            v_required_qty,
            v_bom_record.default_purchase_price,
            format('Production de %s x %s', p_quantity_to_produce, v_item_name),
            NOW()
        );
    END LOOP;

    -- B. Add Finished Product - ONLY INSERT MOVEMENT, trigger will update quantity_on_hand
    -- REMOVED: Direct update of quantity_on_hand (trigger handles this)
    -- UPDATE items
    -- SET quantity_on_hand = quantity_on_hand + p_quantity_to_produce
    -- WHERE id = p_item_id;

    -- Calculate unit cost for the finished product based on components
    DECLARE
        v_unit_production_cost NUMERIC := 0;
    BEGIN
        IF p_quantity_to_produce > 0 THEN
            v_unit_production_cost := v_total_cost / p_quantity_to_produce;
        END IF;

        -- Insert ENTREE movement - trigger will add stock
        INSERT INTO stock_movements (
            company_id, 
            item_id, 
            movement_type, 
            quantity, 
            unit_price, 
            notes, 
            created_at
        ) VALUES (
            p_company_id,
            p_item_id,
            'ENTREE',
            p_quantity_to_produce,
            v_unit_production_cost,
            'Sortie de Production',
            NOW()
        );
    END;

    RETURN jsonb_build_object('success', true, 'message', 'Production enregistrée avec succès');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
