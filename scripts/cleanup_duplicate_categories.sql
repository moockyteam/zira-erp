
-- Create a temporary table to identify duplicates
CREATE TEMP TABLE duplicates AS
SELECT id
FROM (
  SELECT id,
  ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) as rnum
  FROM supplier_categories
  WHERE parent_id IS NULL -- Only check top-level categories for now
) t
WHERE t.rnum > 1;

-- Delete the duplicates
DELETE FROM supplier_categories
WHERE id IN (SELECT id FROM duplicates);

-- Drop the temp table
DROP TABLE duplicates;

-- Now do the same for subcategories (partition by name AND parent_id)
CREATE TEMP TABLE sub_duplicates AS
SELECT id
FROM (
  SELECT id,
  ROW_NUMBER() OVER (PARTITION BY name, parent_id ORDER BY id) as rnum
  FROM supplier_categories
  WHERE parent_id IS NOT NULL
) t
WHERE t.rnum > 1;

DELETE FROM supplier_categories
WHERE id IN (SELECT id FROM sub_duplicates);

DROP TABLE sub_duplicates;

-- Add a unique constraint to prevent future duplicates (optional but recommended)
-- ALTER TABLE supplier_categories ADD CONSTRAINT unique_category_name_per_company UNIQUE (name, COALESCE(company_id, '00000000-0000-0000-0000-000000000000'));
-- Note: handling NULL in unique constraints varies, and we have parent_id too.
-- For now, just cleaning is sufficient.
