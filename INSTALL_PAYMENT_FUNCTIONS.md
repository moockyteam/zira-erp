# Instructions: Installer les Fonctions de Gestion des Paiements

## Étape 1: Appliquer le SQL dans Supabase

1. **Ouvrir Supabase Dashboard**: https://supabase.com/dashboard
2. **Sélectionner votre projet**
3. **SQL Editor** (menu gauche) → **New query**
4. **Copier tout le contenu** du fichier `sql_global_payment_management.sql`
5. **Exécuter** (`Run` ou `Ctrl+Enter`)

Vous devriez voir: "Success. No rows returned"

## Étape 2: Vérifier les fonctions

Exécutez cette requête pour confirmer que les fonctions sont créées:

```sql
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'delete_global_payment_allocation',
    'update_global_payment_amount',
    'get_payment_details'
)
ORDER BY routine_name;
```

Vous devriez voir 3 fonctions listées.

## Étape 3: Test rapide (Optionnel)

Pour tester qu'une fonction fonctionne, vous pouvez:

```sql
-- Exemple: Obtenir les détails d'un paiement facture
-- Remplacer 'VOTRE_PAYMENT_ID' par un vrai ID de invoice_payments
SELECT get_payment_details('INVOICE', 'VOTRE_PAYMENT_ID');
```

## Fonctions Créées

✅ **delete_global_payment_allocation** - Supprime un paiement et recalcule les soldes
✅ **update_global_payment_amount** - Modifie le montant d'un paiement
✅ **get_payment_details** - Récupère les infos d'un paiement

## Next Steps

Après avoir installé ces fonctions SQL, je vais créer les composants UI pour les utiliser.
