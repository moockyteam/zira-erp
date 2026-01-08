-- 1. Create the Enum Type for Item Types
-- We use 'product' as the internal name for "Marchandise" to match the default behavior.
DO $$ BEGIN
    CREATE TYPE item_type_enum AS ENUM ('product', 'raw_material', 'semi_finished', 'consumable', 'asset');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add 'type' column to 'items' table
-- DEFAULT 'product' ensures that all existing data remains valid and behaves as "Marchandise".
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS type item_type_enum NOT NULL DEFAULT 'product';

-- 3. Add 'consumption_unit' column
-- This is used for Raw Materials (e.g. buying in kg, consuming in grams).
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS consumption_unit TEXT;

-- 4. Create 'bill_of_materials' table (The Recipe/Composition)
create table if not exists bill_of_materials (
  id uuid default gen_random_uuid() primary key,
  parent_item_id uuid references items(id) on delete cascade not null,
  child_item_id uuid references items(id) on delete restrict not null, -- Prevent deleting an item if it's used in a recipe
  quantity numeric not null check (quantity > 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Prevent valid cycles or duplicates (A product cannot contain itself directly, though indirect cycles need application logic check)
  constraint bom_unique_ingredient unique (parent_item_id, child_item_id),
  constraint bom_no_self_reference check (parent_item_id != child_item_id)
);

-- 5. Add RLS Policies for Bill Of Materials
-- Enable RLS
ALTER TABLE bill_of_materials ENABLE ROW LEVEL SECURITY;

-- Create Policy (Assumes companies logic applies via join through items, but usually BOM is company-agnostic if items are scoped. 
-- However, items are scoped by company_id. So we need to ensure users can only access BOMs for items in their company.)
-- Simplified policy: If I can see the parent item, I can see the BOM.

DROP POLICY IF EXISTS "Users can view BOM of visible items" ON bill_of_materials;
CREATE POLICY "Users can view BOM of visible items" ON bill_of_materials
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM items
    WHERE items.id = bill_of_materials.parent_item_id
    -- The items table typically has its own RLS checking company_id vs user's companies
  )
);

-- For write operations, strict check on company ownership of the parent item
DROP POLICY IF EXISTS "Users can edit BOM of their company items" ON bill_of_materials;
CREATE POLICY "Users can edit BOM of their company items" ON bill_of_materials
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM items
    WHERE items.id = bill_of_materials.parent_item_id
    -- We assume the user has access to this item via existing Items RLS policies
  )
);
