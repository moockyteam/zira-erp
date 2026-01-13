-- Check for triggers on items and stock_movements tables
-- Run this in Supabase SQL Editor

-- 1. List all triggers on 'items' table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'items';

-- 2. List all triggers on 'stock_movements' table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'stock_movements';

-- 3. Check if there's a trigger that updates quantity_on_hand
SELECT 
    tgname AS trigger_name,
    proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname IN ('items', 'stock_movements', 'bill_of_materials')
  AND NOT t.tgisinternal;
