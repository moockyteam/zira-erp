-- Fix duplicate BOM entries and verify constraint
-- Run this in Supabase SQL Editor

-- Step 1: Check for duplicate entries
SELECT parent_item_id, child_item_id, COUNT(*), SUM(quantity) as total_qty
FROM bill_of_materials 
GROUP BY parent_item_id, child_item_id 
HAVING COUNT(*) > 1;

-- Step 2: If duplicates exist, delete them keeping only one
-- First, identify duplicates to delete (keeps the oldest one)
DELETE FROM bill_of_materials a
USING bill_of_materials b
WHERE a.id > b.id  -- Keep the row with the smaller id (oldest)
  AND a.parent_item_id = b.parent_item_id 
  AND a.child_item_id = b.child_item_id;

-- Step 3: Verify the unique constraint exists
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE table_name = 'bill_of_materials' AND constraint_type = 'UNIQUE';

-- Step 4: If constraint doesn't exist, add it
-- ALTER TABLE bill_of_materials 
-- ADD CONSTRAINT bom_unique_ingredient UNIQUE (parent_item_id, child_item_id);
