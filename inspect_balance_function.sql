-- SCRIPT DE VÉRIFICATION
-- Affiche le code source actuel de la fonction calculate_customer_balance

SELECT 
    proname as "Nom Fonction",
    pg_get_function_arguments(oid) as "Arguments",
    pg_get_functiondef(oid) as "Code Source Complet"
FROM pg_proc
WHERE proname = 'calculate_customer_balance';
