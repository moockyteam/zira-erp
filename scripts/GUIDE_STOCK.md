# Guide: Page "Stock"

Ce guide détaille le fonctionnement du module de gestion de l'inventaire (`/dashboard/stock`).

## 1. Vue d'ensemble

Le module Stock est central pour votre gestion commerciale et production. Il permet de :
- Créer et classer vos articles (Marchandises, matières premières, produits finis).
- Suivre les quantités en temps réel (`quantity_on_hand`).
- Gérer les **recettes/nomenclatures** (Bill of Materials) pour la production.
- Enregistrer les mouvements (Entrées, Sorties, Ajustements).
- Analyser la valeur de votre stock.

## 2. Structure des Fichiers

- **Page Principale** : `app/dashboard/stock/page.tsx`
    - Affiche la liste et les indicateurs clés (KPIs).
- **Gestionnaire** : `components/stock-manager.tsx`
    - Orchestre l'affichage et les dialogues.
- **Création/Modif** : `components/manage-item-dialog.tsx`
    - Formulaire complexe gérant le type d'article, les fournisseurs liés, et les recettes (BOM).
- **Mouvements** : `components/stock-entry-dialog.tsx`
    - Pour les entrées manuelles.
    - Appelle la fonction RPC `add_stock_movement`.

## 3. Pré-requis Base de Données

Les tables suivantes sont nécessaires (voir `scripts/setup_stock_table.sql`) :

1.  **`public.items`** : Table maîtresse des articles.
2.  **`public.item_suppliers`** : Lien N-N entre articles et fournisseurs (prix d'achat spécifique, ref).
3.  **`public.stock_movements`** : Historique de tous les mouvements.
4.  **`public.bill_of_materials`** : Recettes (Ingrédients pour produits finis).

**Fonctions RPC requises :**
- `add_stock_movement` : Fonction clé qui insère un mouvement ET met à jour `items.quantity_on_hand` de manière atomique.

## 4. Guide d'Utilisation

### Étape 1 : Créer un Article
- **Type** :
    - *Marchandise* : Achat pour revente.
    - *Matière Première* : Pour fabrication.
    - *Produit Fini* : Composé de matières premières.
- **Données** : Prix d'achat (pour valorisation), Prix vente, Seuil d'alerte.

### Étape 2 : Recettes (Pour Produits Finis)
Si vous créez un "Produit Fini", une section "Composition" apparaît. Ajoutez les matières premières nécessaires. Cela servira lors de l'ordre de fabrication pour déduire les stocks de composants automatiquement.

### Étape 3 : Mouvements de Stock
- **Entrée** : Via le bouton "+" ou lors de la réception d'une Commande Achat.
- **Sortie** : Automatique lors d'une Vente (Facture/BL) ou manuelle (Ajustement).
- **Inventaire** : Utilisez la fonction "Ajuster" pour corriger les écarts lors de vos inventaires physiques.
