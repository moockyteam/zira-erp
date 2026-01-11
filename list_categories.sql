-- SQL to list all categories
SELECT 
    sc.id, 
    sc.name, 
    sc.parent_id, 
    parent.name AS parent_name
FROM 
    supplier_categories sc
LEFT JOIN 
    supplier_categories parent ON sc.parent_id = parent.id
ORDER BY 
    sc.name;
