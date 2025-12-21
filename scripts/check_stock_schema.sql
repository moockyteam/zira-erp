
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stock_movements';

SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'add_stock_movement';
