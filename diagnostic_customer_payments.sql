-- =====================================================
-- DIAGNOSTIC COMPLET POUR LE CLIENT
-- ID: d75a5346-121f-40c0-a5ac-2ac824c8de6a
-- =====================================================

-- 1. Informations du client
SELECT 
    id,
    name,
    initial_balance,
    balance as stored_balance,
    balance_start_date
FROM customers 
WHERE id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a';

-- 2. Calcul du solde via la fonction RPC
SELECT calculate_customer_balance('d75a5346-121f-40c0-a5ac-2ac824c8de6a') as calculated_balance;

-- =====================================================
-- 3. TOUTES LES FACTURES du client (avec statut)
-- =====================================================
SELECT 
    id,
    invoice_number,
    invoice_date,
    status,
    total_ht,
    total_tva,
    total_ttc,
    source_delivery_note_id
FROM invoices 
WHERE customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'
ORDER BY invoice_date DESC;

-- =====================================================
-- 4. TOUS LES BONS DE LIVRAISON du client
-- =====================================================
SELECT 
    id,
    delivery_note_number,
    delivery_date,
    status,
    is_valued,
    total_ht,
    total_tva,
    total_ttc,
    invoice_id
FROM delivery_notes 
WHERE customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'
ORDER BY COALESCE(delivery_date, created_at) DESC;

-- =====================================================
-- 5. TOUS LES PAIEMENTS SUR FACTURES
-- =====================================================
SELECT 
    ip.id as payment_id,
    ip.payment_date,
    ip.amount,
    ip.payment_method,
    ip.notes,
    i.invoice_number,
    i.total_ttc as invoice_total
FROM invoice_payments ip
JOIN invoices i ON ip.invoice_id = i.id
WHERE i.customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'
ORDER BY ip.payment_date DESC;

-- =====================================================
-- 6. TOUS LES PAIEMENTS SUR BL
-- =====================================================
SELECT 
    dp.id as payment_id,
    dp.payment_date,
    dp.amount,
    dp.payment_method,
    dp.notes,
    dn.delivery_note_number,
    dn.total_ttc as bl_total
FROM delivery_note_payments dp
JOIN delivery_notes dn ON dp.delivery_note_id = dn.id
WHERE dn.customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'
ORDER BY dp.payment_date DESC;

-- =====================================================
-- 7. RÉSUMÉ DES TOTAUX
-- =====================================================
SELECT 
    'Factures Valides' as type,
    COUNT(*) as count,
    COALESCE(SUM(total_ttc), 0) as total
FROM invoices 
WHERE customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'
  AND status NOT IN ('BROUILLON', 'ANNULEE')
  AND source_delivery_note_id IS NULL

UNION ALL

SELECT 
    'BL Non Facturés' as type,
    COUNT(*) as count,
    COALESCE(SUM(total_ttc), 0) as total
FROM delivery_notes 
WHERE customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'
  AND status = 'LIVRE'
  AND invoice_id IS NULL
  AND (is_valued = true OR total_ttc > 0)

UNION ALL

SELECT 
    'Paiements Factures' as type,
    COUNT(*) as count,
    COALESCE(SUM(ip.amount), 0) as total
FROM invoice_payments ip
JOIN invoices i ON ip.invoice_id = i.id
WHERE i.customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'

UNION ALL

SELECT 
    'Paiements BL' as type,
    COUNT(*) as count,
    COALESCE(SUM(dp.amount), 0) as total
FROM delivery_note_payments dp
JOIN delivery_notes dn ON dp.delivery_note_id = dn.id
WHERE dn.customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a';

-- =====================================================
-- 8. PAIEMENTS REGROUPÉS PAR DATE + MÉTHODE
-- (C'est ce que GlobalCollectionsManager affiche)
-- =====================================================
SELECT 
    date_trunc('day', payment_date)::date as jour,
    method,
    SUM(amount) as total_groupe,
    COUNT(*) as nb_paiements,
    STRING_AGG(reference, ', ') as documents
FROM (
    SELECT 
        ip.payment_date,
        ip.payment_method as method,
        ip.amount,
        i.invoice_number as reference
    FROM invoice_payments ip
    JOIN invoices i ON ip.invoice_id = i.id
    WHERE i.customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'
    
    UNION ALL
    
    SELECT 
        dp.payment_date,
        dp.payment_method as method,
        dp.amount,
        dn.delivery_note_number as reference
    FROM delivery_note_payments dp
    JOIN delivery_notes dn ON dp.delivery_note_id = dn.id
    WHERE dn.customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'
) combined
GROUP BY date_trunc('day', payment_date)::date, method
ORDER BY jour DESC;

-- =====================================================
-- 9. DÉTECTION: Paiements récents avec montant 284.865 ou 300
-- =====================================================
SELECT 
    'invoice_payments' as source,
    ip.id,
    ip.payment_date,
    ip.amount,
    ip.payment_method,
    ip.notes,
    ip.created_at
FROM invoice_payments ip
JOIN invoices i ON ip.invoice_id = i.id
WHERE i.customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'
  AND (ip.amount BETWEEN 280 AND 305 OR ip.notes LIKE '%300%')
ORDER BY ip.created_at DESC;
