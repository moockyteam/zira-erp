-- 1. Lister les triggers sur delivery_note_lines
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'delivery_note_lines';

-- 2. Voir le code de la fonction RPC 'deduct_stock_from_delivery_note'
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'deduct_stock_from_delivery_note';
