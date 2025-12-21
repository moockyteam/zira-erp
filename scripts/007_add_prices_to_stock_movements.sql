-- Migration: Add price columns to stock_movements and update RPC
ALTER TABLE stock_movements 
ADD COLUMN IF NOT EXISTS unit_price NUMERIC,
ADD COLUMN IF NOT EXISTS current_sale_price NUMERIC;

-- Update the RPC to accept prices
CREATE OR REPLACE FUNCTION add_stock_movement(
  p_company_id UUID,
  p_item_id UUID,
  p_movement_type TEXT,
  p_quantity NUMERIC,
  p_supplier_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_unit_price NUMERIC DEFAULT NULL,
  p_current_sale_price NUMERIC DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_new_quantity NUMERIC;
BEGIN
  -- Insert with prices
  INSERT INTO stock_movements (company_id, item_id, movement_type, quantity, supplier_id, notes, unit_price, current_sale_price)
  VALUES (p_company_id, p_item_id, p_movement_type::movement_type, p_quantity, p_supplier_id, p_notes, p_unit_price, p_current_sale_price);

  -- If it's an entry and a purchase price is provided, update the item's default purchase price (optional, but useful)
  IF p_movement_type = 'ENTREE' AND p_unit_price IS NOT NULL THEN
    UPDATE items SET default_purchase_price = p_unit_price WHERE id = p_item_id;
  END IF;

  SELECT quantity_on_hand INTO v_new_quantity
  FROM items
  WHERE id = p_item_id;

  RETURN jsonb_build_object('success', true, 'new_quantity', v_new_quantity);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
