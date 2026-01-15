-- =====================================================
-- DIAGNOSTIC APPROFONDI - Pour comprendre les écarts
-- =====================================================

-- =============================================================================
-- 1. ANALYSER LE CLIENT AVEC LE PLUS GROS ÉCART (RINES GLOBAL INTERMEDIATION)
-- Trouver son ID d'abord
-- =============================================================================
SELECT id, name, balance, initial_balance, balance_start_date
FROM customers
WHERE name LIKE '%RINES%';

-- =============================================================================
-- 2. VOIR LES TRIGGERS QUI MODIFIENT customers.balance
-- =============================================================================
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgname LIKE '%balance%'
   OR tgname LIKE '%payment%';

-- =============================================================================
-- 3. VOIR LE CODE DE record_payment (pour vérifier s'il modifie balance)
-- =============================================================================
SELECT pg_get_functiondef(oid) AS code_source
FROM pg_proc
WHERE proname = 'record_payment';

-- =============================================================================
-- 4. VOIR LE CODE DE record_delivery_note_payment
-- =============================================================================
SELECT pg_get_functiondef(oid) AS code_source
FROM pg_proc
WHERE proname = 'record_delivery_note_payment';

-- =============================================================================
-- 5. POUR UN CLIENT AVEC ÉCART - Détailler tous les mouvements
-- (Remplacez l'UUID par celui de RINES une fois trouvé)
-- =============================================================================

-- 5a. Ses factures
SELECT 'FACTURE' as type, invoice_number, invoice_date, total_ttc, status
FROM invoices
WHERE customer_id = (SELECT id FROM customers WHERE name LIKE '%RINES%' LIMIT 1)
  AND status NOT IN ('BROUILLON', 'ANNULEE')
ORDER BY invoice_date;

-- 5b. Ses BL non facturés
SELECT 'BL' as type, delivery_note_number, delivery_date, total_ttc, status, invoice_id
FROM delivery_notes
WHERE customer_id = (SELECT id FROM customers WHERE name LIKE '%RINES%' LIMIT 1)
  AND status = 'LIVRE'
ORDER BY delivery_date;

-- 5c. Ses paiements sur factures
SELECT 'PAY_INV' as type, ip.payment_date, ip.amount, ip.payment_method, ip.global_payment_id,
       i.invoice_number
FROM invoice_payments ip
JOIN invoices i ON ip.invoice_id = i.id
WHERE i.customer_id = (SELECT id FROM customers WHERE name LIKE '%RINES%' LIMIT 1)
ORDER BY ip.payment_date;

-- 5d. Ses paiements sur BL
SELECT 'PAY_BL' as type, dp.payment_date, dp.amount, dp.payment_method, dp.global_payment_id,
       dn.delivery_note_number
FROM delivery_note_payments dp
JOIN delivery_notes dn ON dp.delivery_note_id = dn.id
WHERE dn.customer_id = (SELECT id FROM customers WHERE name LIKE '%RINES%' LIMIT 1)
ORDER BY dp.payment_date;

-- 5e. Ses paiements globaux
SELECT 'GLOBAL' as type, payment_date, amount, amount_allocated, amount_credited, payment_method
FROM global_payment_entries
WHERE customer_id = (SELECT id FROM customers WHERE name LIKE '%RINES%' LIMIT 1)
ORDER BY payment_date;

-- 5f. Ses crédits
SELECT 'CREDIT' as type, payment_date, amount, payment_method
FROM customer_credits
WHERE customer_id = (SELECT id FROM customers WHERE name LIKE '%RINES%' LIMIT 1)
ORDER BY payment_date;

-- =============================================================================
-- 6. RÉSUMÉ CALCUL POUR CE CLIENT
-- =============================================================================
SELECT 
    c.name,
    c.initial_balance,
    COALESCE((SELECT SUM(total_ttc) FROM invoices WHERE customer_id = c.id AND status NOT IN ('BROUILLON', 'ANNULEE') AND source_delivery_note_id IS NULL), 0) AS total_factures,
    COALESCE((SELECT SUM(total_ttc) FROM delivery_notes WHERE customer_id = c.id AND status = 'LIVRE' AND invoice_id IS NULL), 0) AS total_bl,
    COALESCE((SELECT SUM(p.amount) FROM invoice_payments p JOIN invoices i ON p.invoice_id = i.id WHERE i.customer_id = c.id), 0) AS total_pay_factures,
    COALESCE((SELECT SUM(p.amount) FROM delivery_note_payments p JOIN delivery_notes dn ON p.delivery_note_id = dn.id WHERE dn.customer_id = c.id), 0) AS total_pay_bl,
    COALESCE((SELECT SUM(amount) FROM customer_credits WHERE customer_id = c.id), 0) AS total_credits,
    c.balance AS solde_stocke,
    calculate_customer_balance(c.id) AS solde_calcule
FROM customers c
WHERE c.name LIKE '%RINES%';
