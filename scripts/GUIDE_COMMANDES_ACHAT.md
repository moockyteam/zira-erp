# Guide: Page "Bons de Commande"

Ce guide détaille le fonctionnement du module Achats (`/dashboard/purchase-orders`).

## 1. Vue d'ensemble

Le module Achats permet de :
- Gérer les commandes fournisseurs (création, envoi, suivi).
- Réceptionner la marchandise et **mettre à jour le stock automatiquement**.
- Faire le lien entre votre boutique (produits) et vos dépenses.

## 2. Structure des Fichiers

- **Page Liste** : `app/dashboard/purchase-orders/page.tsx`
    - Filtres par statut (Brouillon, Envoyé, Reçu) et fournisseur.
- **Formulaire** : `components/purchase-orders/po-form.tsx`
    - Création de commande.
    - Sélection des articles depuis la base de données (`items`) ou saisie libre.
- **Réception** : `components/purchase-orders/receipt-dialog.tsx`
    - **CRITIQUE** : C'est ici que se fait l'entrée en stock.
    - Appelle une procédure stockée `process_purchase_receipt` pour incrémenter les quantités.

## 3. Pré-requis Base de Données

Les tables suivantes sont nécessaires (voir `scripts/setup_purchase_orders_table.sql`) :

1.  **`public.purchase_orders`** : Entêtes des commandes.
2.  **`public.purchase_order_lines`** : Lignes de commande.
3.  **`public.purchase_receipts`** : Historique des réceptions.
4.  **`public.purchase_receipt_lines`** : Détail des quantités reçues.

**Fonctions RPC requises :**
- `get_next_po_number` : Génération numéro commande (BC-2024-XXX).
- `get_next_receipt_number` : Génération numéro réception (BR-2024-XXX).
- `process_purchase_receipt` : **Fonction vitale**. Elle parcourt les lignes du bon de réception et ajoute `quantity_received` au stock actuel de l'article (`items.quantity`).

## 4. Guide d'Utilisation

### Étape 1 : Créer un Bon de Commande (BC)
1.  Sélectionnez le fournisseur.
2.  Ajoutez des articles :
    - *Article existant* : La réception incrémentera son stock.
    - *Article libre* : Utile pour des achats non stockés (fournitures bureau, etc.), mais ne fera pas de mouvement de stock.
3.  Sauvegardez (Statut "BROUILLON").
4.  Passez en "ENVOYE" quand vous l'expédiez au fournisseur.

### Étape 2 : Réceptionner la Marchandise
Quand le camion arrive :
1.  Ouvrez le BC dans la liste.
2.  Cliquez sur l'icône "Camion" (Réceptionner).
3.  Vérifiez les quantités reçues (modifiables si livraison partielle ou surplus).
4.  Validez.
    - Le stock est mis à jour immédiatement.
    - Le statut du BC passe à "RECU".
