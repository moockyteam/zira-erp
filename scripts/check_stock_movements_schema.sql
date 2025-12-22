-- Inspecter la structure de la table stock_movements pour voir toutes les colonnes et contraintes
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'stock_movements'
ORDER BY ordinal_position;
