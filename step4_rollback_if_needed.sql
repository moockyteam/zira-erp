-- =====================================================
-- ROLLBACK: Restaurer les soldes si problème
-- Exécutez SEULEMENT si vous voulez annuler la correction
-- =====================================================

-- =============================================================================
-- 1. RESTAURER LES SOLDES D'ORIGINE
-- =============================================================================

UPDATE customers c
SET balance = b.solde_avant_correction
FROM customers_balance_backup_20260115 b
WHERE c.id = b.id;

-- Vérifier la restauration
SELECT 
    c.name,
    c.balance AS solde_restaure,
    b.solde_avant_correction AS solde_backup
FROM customers c
JOIN customers_balance_backup_20260115 b ON c.id = b.id
WHERE c.balance != b.solde_avant_correction
LIMIT 10;

-- Si la requête ci-dessus retourne 0 lignes, la restauration est réussie

-- =============================================================================
-- 2. NOTE: Les triggers et fonctions resteront modifiés
-- Pour un rollback complet des fonctions, il faudrait les recréer
-- avec l'ancien code (voir pg_get_functiondef qu'on a récupéré plus tôt)
-- =============================================================================
