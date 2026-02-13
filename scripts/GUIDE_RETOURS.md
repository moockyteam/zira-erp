# Guide: Page "Bons de Retour" (Returns)

Ce guide détaille le fonctionnement du module de gestion des retours de marchandises (`/dashboard/returns`).

## 1. Vue d'ensemble

Le Bon de Retour (BR) permet d'enregistrer la ré-entrée de marchandises précédemment vendues ou livrées. Il sert de justificatif pour :
- Réintégrer le stock.
- Justifier un avoir client ou un remboursement.
- Suivre les motifs d'insatisfaction ou de défaut.

## 2. Structure des Fichiers

- **Page Liste** : `app/dashboard/returns/page.tsx`
- **Composant Manager** : `components/returns/return-voucher-manager.tsx`
- **Formulaire** : `components/returns/return-voucher-form.tsx`
- **Actions** : `components/returns/return-voucher-actions.tsx`
- **Historique Client** : `components/returns/customer-history-dialog.tsx` (Permet de retrouver les numéros de factures/BL pour la référence).

## 3. Flux de Travail et Statuts

### Statuts du BR
- **BROUILLON** : En cours de saisie. Le stock n'est pas encore impacté.
- **RETOURNE** : Retour validé. La marchandise est considérée comme ré-entrée en stock.
- **ANNULE** : Retour annulé.

## 4. Pré-requis Base de Données

Tables requises (voir `scripts/setup_returns_table.sql`) :
1.  **`public.return_vouchers`** : En-tête du bon de retour.
2.  **`public.return_voucher_lines`** : Articles et quantités retournés.

**Fonctions RPC requises :**
- `get_next_return_voucher_number` : Pour la génération automatique des numéros de BR (ex: `RET-2026-001`).

## 5. Guide d'Utilisation

### Étape 1 : Créer un Bon de Retour
1.  Cliquez sur **"Nouveau Bon de Retour"**.
2.  Sélectionnez le **Client**.
3.  Utilisez l'icône "Historique" à côté du champ client pour identifier le document d'origine (Facture ou BL). Cela remplit le champ **"Réf. Document d'Origine"**.
4.  Ajoutez les articles retournés, leurs quantités et le **motif du retour** (ex: Produit défectueux, erreur de commande).

### Étape 2 : Réintégration en Stock
Une fois le retour physiquement reçu, passez le statut à **RETOURNE**. 
*Note : Pour le moment, l'impact stock automatique lors du passage au statut RETOURNE dépend de vos triggers de base de données.*

### Étape 3 : Impression
Utilisez le menu d'actions pour générer l'aperçu ou imprimer le document à remettre au client comme preuve de réception.
