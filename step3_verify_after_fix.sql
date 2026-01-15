-- =====================================================
-- ÉTAPE 3: VÉRIFICATION APRÈS CORRECTION
-- Exécutez ceci APRÈS fix_payment_calculation.sql
-- =====================================================

-- =============================================================================
-- 1. COMPARER AVANT/APRÈS
-- =============================================================================

SELECT 
    c.name,
    b.solde_avant_correction,
    c.balance AS solde_apres_correction,
    b.solde_calcule_avant,
    calculate_customer_balance(c.id) AS solde_calcule_apres,
    ROUND(c.balance - b.solde_avant_correction, 3) AS variation,
    CASE 
        WHEN c.balance = calculate_customer_balance(c.id) THEN '✅ OK'
        ELSE '❌ ERREUR'
    END AS status
FROM customers c
JOIN customers_balance_backup_20260115 b ON c.id = b.id
ORDER BY ABS(c.balance - b.solde_avant_correction) DESC
LIMIT 30;

-- =============================================================================
-- 2. VÉRIFIER QUE TOUS LES SOLDES SONT SYNCHRONISÉS
-- =============================================================================

SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ TOUS LES SOLDES SONT CORRECTEMENT SYNCHRONISÉS'
        ELSE '❌ ' || COUNT(*) || ' clients ont encore un écart'
    END AS verification_status
FROM customers c
WHERE c.balance != calculate_customer_balance(c.id);

-- =============================================================================
-- 3. LISTER LES CLIENTS AVEC ÉCART (si il y en a)
-- =============================================================================

SELECT 
    c.name,
    c.balance AS solde_stocke,
    calculate_customer_balance(c.id) AS solde_calcule,
    c.balance - calculate_customer_balance(c.id) AS ecart
FROM customers c
WHERE c.balance != calculate_customer_balance(c.id)
ORDER BY ABS(c.balance - calculate_customer_balance(c.id)) DESC;

-- =============================================================================
-- 4. VÉRIFIER LES TRIGGERS ACTIFS
-- =============================================================================

SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    CASE WHEN tgenabled = 'O' THEN 'ACTIF' ELSE 'DÉSACTIVÉ' END AS status
FROM pg_trigger
WHERE tgname LIKE 'tr_balance%'
ORDER BY tgrelid::regclass, tgname;

-- =============================================================================
-- 5. TESTER UN NOUVEAU CALCUL (RINES par exemple)
-- =============================================================================

SELECT 
    c.name,
    c.balance AS solde_actuel,
    calculate_customer_balance(c.id) AS solde_calcule,
    CASE 
        WHEN c.balance = calculate_customer_balance(c.id) THEN '✅ SYNCHRONISÉ'
        ELSE '❌ DÉSYNCHRONISÉ'
    END AS status
FROM customers c
WHERE c.name LIKE '%RINES%';

-- =============================================================================
-- 6. STATISTIQUES GÉNÉRALES
-- =============================================================================

SELECT 
    COUNT(*) AS total_clients,
    SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END) AS clients_debiteurs,
    SUM(CASE WHEN balance < 0 THEN 1 ELSE 0 END) AS clients_crediteurs,
    SUM(CASE WHEN balance = 0 THEN 1 ELSE 0 END) AS clients_equilibres,
    ROUND(SUM(balance), 3) AS solde_total
FROM customers;
