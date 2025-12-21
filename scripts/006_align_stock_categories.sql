-- 1. Add subcategory_id to items
ALTER TABLE items
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES supplier_categories(id);

-- 2. Drop the old foreign key constraint on category_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'items_category_id_fkey') THEN
    ALTER TABLE items DROP CONSTRAINT items_category_id_fkey;
  END IF;
END $$;

-- 3. Migrate ALL existing items to "Commerce & Distribution" -> "Marchandises (Vente en l'état)"
-- We use a DO block to find the IDs dynamically to avoid hardcoding UUIDs
DO $$
DECLARE
  target_cat_id UUID;
  target_sub_id UUID;
BEGIN
  -- Find "Commerce & Distribution"
  SELECT id INTO target_cat_id 
  FROM supplier_categories 
  WHERE name ILIKE 'Commerce & Distribution%' 
  AND parent_id IS NULL 
  LIMIT 1;

  -- Find "Marchandises (Vente en l'état)" (checking parent to be sure)
  SELECT id INTO target_sub_id 
  FROM supplier_categories 
  WHERE name ILIKE 'Marchandises%' 
  AND parent_id = target_cat_id 
  LIMIT 1;

  -- Update all items
  IF target_cat_id IS NOT NULL AND target_sub_id IS NOT NULL THEN
    UPDATE items 
    SET category_id = target_cat_id, 
        subcategory_id = target_sub_id;
  ELSE
    -- Fallback: If not found, just nullify (though this shouldn't happen with correct seed)
    -- Or raise notice
    RAISE NOTICE 'Target categories not found. Setting to NULL.';
    UPDATE items SET category_id = NULL, subcategory_id = NULL; 
  END IF;
END $$;

-- 4. Add new FK to category_id pointing to supplier_categories
-- Now that data is clean/migrated, we can add the constraint safely
ALTER TABLE items
   ADD CONSTRAINT items_category_id_fkey
   FOREIGN KEY (category_id)
   REFERENCES supplier_categories(id);
