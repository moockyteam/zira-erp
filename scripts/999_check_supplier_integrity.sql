-- List all triggers on the supplier_categories table
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_statement, 
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'supplier_categories';

-- List all constraints (foreign keys, checks, etc.)
SELECT 
    conname as constraint_name, 
    contype as constraint_type, 
    pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'supplier_categories';

-- List Policies (RLS)
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'supplier_categories';
