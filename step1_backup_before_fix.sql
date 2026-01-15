-- =====================================================
-- ÉTAPE 1: SAUVEGARDE AVANT CORRECTION
-- Exécutez ceci AVANT d'appliquer fix_payment_calculation.sql
-- =====================================================

-- =============================================================================
-- 1. CRÉER UNE TABLE DE BACKUP DES SOLDES
-- =============================================================================

CREATE TABLE IF NOT EXISTS customers_balance_backup_20260115 AS
SELECT 
    id,
    name,
    balance AS solde_avant_correction,
    initial_balance,
    balance_start_date,
    calculate_customer_balance(id) AS solde_calcule_avant,
    NOW() AS backup_date
FROM customers;

-- Vérifier que la sauvegarde est créée
SELECT COUNT(*) AS nb_clients_sauvegardes FROM customers_balance_backup_20260115;

-- =============================================================================
-- 2. VOIR LES 20 PLUS GROS ÉCARTS (pour référence)
-- =============================================================================

SELECT 
    name,
    solde_avant_correction,
    solde_calcule_avant,
    ROUND(solde_avant_correction - solde_calcule_avant, 3) AS ecart
FROM customers_balance_backup_20260115
ORDER BY ABS(solde_avant_correction - solde_calcule_avant) DESC
LIMIT 20;

-- =============================================================================
-- 3. SAUVEGARDER LES TRIGGERS EXISTANTS (liste pour référence)
-- =============================================================================

-- Juste pour garder une trace des triggers avant suppression
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgname LIKE '%balance%' 
   OR tgname LIKE '%payment%'
   OR tgname LIKE '%customer%'
ORDER BY tgrelid::regclass, tgname;

-- =============================================================================
-- ✅ SI TOUT EST OK, PASSEZ À L'ÉTAPE 2: CORRECTION
-- =============================================================================
-- Exécutez ensuite: fix_payment_calculation.sql
