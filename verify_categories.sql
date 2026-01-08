-- VERIFICATION SCRIPT
-- This query returns ANY item that is NOT correctly categorized.
-- If the result is EMPTY (0 rows), then everything is 100% correct.
-- If you see any rows, these are the items that are still wrong.

SELECT 
    i.id, 
    i.name as item_name, 
    c.name as current_category,
    s.name as current_subcategory,
    i.company_id
FROM items i
LEFT JOIN supplier_categories c ON i.category_id = c.id
LEFT JOIN supplier_categories s ON i.subcategory_id = s.id
WHERE 
    -- Condition: Fail if Category is NOT 'Commerce & Distribution'
    (c.name IS DISTINCT FROM 'Commerce & Distribution')
    OR 
    -- Condition: Fail if Subcategory is NOT 'Marchandise'
    (s.name IS DISTINCT FROM 'Marchandise')
ORDER BY i.name;
