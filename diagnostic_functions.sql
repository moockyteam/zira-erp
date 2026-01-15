-- =====================================================
-- DIAGNOSTIC: Vérifier les fonctions existantes dans Supabase
-- Exécutez ces requêtes dans Supabase SQL Editor
-- =====================================================

-- =============================================================================
-- 1. LISTER TOUTES LES FONCTIONS RPC LIÉES AUX PAIEMENTS
-- =============================================================================
SELECT 
    p.proname AS fonction_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'calculate_customer_balance',
    'record_payment',
    'record_delivery_note_payment',
    'record_global_payment',
    'update_global_payment',
    'delete_global_payment'
  )
ORDER BY p.proname;

-- =============================================================================
-- 2. VOIR LE CODE SOURCE DE calculate_customer_balance
-- =============================================================================
SELECT pg_get_functiondef(oid) AS code_source
FROM pg_proc
WHERE proname = 'calculate_customer_balance';

-- =============================================================================
-- 3. VOIR LE CODE SOURCE DE record_payment
-- =============================================================================
SELECT pg_get_functiondef(oid) AS code_source
FROM pg_proc
WHERE proname = 'record_payment';

-- =============================================================================
-- 4. VOIR LE CODE SOURCE DE record_delivery_note_payment
-- =============================================================================
SELECT pg_get_functiondef(oid) AS code_source
FROM pg_proc
WHERE proname = 'record_delivery_note_payment';

-- =============================================================================
-- 5. VOIR LE CODE SOURCE DE record_global_payment
-- =============================================================================
SELECT pg_get_functiondef(oid) AS code_source
FROM pg_proc
WHERE proname = 'record_global_payment';

-- =============================================================================
-- 6. VÉRIFIER SI LA TABLE global_payments EXISTE (elle ne devrait PAS)
-- =============================================================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('global_payments', 'global_payment_entries', 'customer_credits');

-- =============================================================================
-- 7. TESTER calculate_customer_balance SUR UN CLIENT
-- (Remplacez l'UUID par un vrai ID client)
-- =============================================================================
-- SELECT calculate_customer_balance('votre-uuid-client-ici');

-- =============================================================================
-- 8. COMPARER LE SOLDE STOCKÉ VS CALCULÉ POUR TOUS LES CLIENTS
-- =============================================================================
SELECT 
    c.id,
    c.name,
    c.balance AS solde_stocke,
    calculate_customer_balance(c.id) AS solde_calcule,
    ROUND(c.balance - calculate_customer_balance(c.id), 3) AS difference
FROM customers c
ORDER BY ABS(c.balance - calculate_customer_balance(c.id)) DESC
LIMIT 20;

-- =============================================================================
-- 9. VÉRIFIER LES PAIEMENTS RÉCENTS (pour voir s'ils ont global_payment_id)
-- =============================================================================
SELECT 
    'invoice_payments' AS source,
    id,
    invoice_id AS document_id,
    amount,
    payment_date,
    payment_method,
    global_payment_id,
    CASE WHEN global_payment_id IS NULL THEN 'DIRECT' ELSE 'GLOBAL' END AS type_paiement
FROM invoice_payments
ORDER BY created_at DESC
LIMIT 10;

-- =============================================================================
-- 10. VÉRIFIER LES PAIEMENTS BL RÉCENTS
-- =============================================================================
SELECT 
    'delivery_note_payments' AS source,
    id,
    delivery_note_id AS document_id,
    amount,
    payment_date,
    payment_method,
    global_payment_id,
    CASE WHEN global_payment_id IS NULL THEN 'DIRECT' ELSE 'GLOBAL' END AS type_paiement
FROM delivery_note_payments
ORDER BY created_at DESC
LIMIT 10;

-- =============================================================================
-- 11. VÉRIFIER LES ENTRÉES GLOBALES
-- =============================================================================
SELECT 
    id,
    customer_id,
    amount,
    amount_allocated,
    amount_to_initial_balance,
    amount_credited,
    payment_date,
    payment_method
FROM global_payment_entries
ORDER BY created_at DESC
LIMIT 10;

-- =============================================================================
-- 12. VÉRIFIER LES CRÉDITS CLIENTS
-- =============================================================================
SELECT 
    id,
    customer_id,
    amount,
    payment_date,
    payment_method,
    source_payment_id
FROM customer_credits
ORDER BY created_at DESC
LIMIT 10;
