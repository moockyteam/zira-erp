-- Query to verify categories are present and correctly configured
SELECT 
    name, 
    applicable_item_types, -- Should be NULL or include correct types
    (SELECT name FROM supplier_categories p WHERE p.id = c.parent_id) as parent_name
FROM supplier_categories c
ORDER BY parent_name NULLS FIRST, name;
