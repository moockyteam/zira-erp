-- Fonction pour ajouter un mouvement de stock
-- NOTE: La mise à jour de la quantité se fait via le trigger existant 'on_stock_movement_insert'
CREATE OR REPLACE FUNCTION add_stock_movement(
  p_company_id UUID,
  p_item_id UUID,
  p_movement_type TEXT,
  p_quantity NUMERIC,
  p_supplier_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_new_quantity NUMERIC;
BEGIN
  -- 1. Insérer le mouvement avec CAST explicite vers le type enum
  -- Le trigger va automatiquement mettre à jour la quantité dans la table 'items'
  INSERT INTO stock_movements (company_id, item_id, movement_type, quantity, supplier_id, notes)
  VALUES (p_company_id, p_item_id, p_movement_type::movement_type, p_quantity, p_supplier_id, p_notes);

  -- 2. Récupérer la nouvelle quantité mise à jour par le trigger
  SELECT quantity_on_hand INTO v_new_quantity
  FROM items
  WHERE id = p_item_id;

  -- 3. Retourner le succès et la nouvelle quantité
  RETURN jsonb_build_object('success', true, 'new_quantity', v_new_quantity);
EXCEPTION WHEN OTHERS THEN
  -- En cas d'erreur, retourner l'erreur
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
