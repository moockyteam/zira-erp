# Guide: Page "Production"

Ce guide explique le fonctionnement du module de gestion de la production (`/dashboard/production`).

## 1. Vue d'ensemble

Le module Production permet de transformer vos matières premières en produits finis ou semi-finis. Il s'appuie sur les **Recettes (BOM)** définies dans le module Stock pour automatiser la déduction des composants.

## 2. Fonctionnement Technique

Contrairement aux autres modules, la production n'est pas une simple gestion de table, mais un **processus atomique** :
1.  **Vérification** : Le système vérifie si vous avez assez de chaque ingrédient en stock.
2.  **Consommation** : Il crée des mouvements de stock "SORTIE" pour chaque composant.
3.  **Création** : Il crée un mouvement de stock "ENTREE" (type Production) pour l'article fini.
4.  **Historisation** : Chaque production est logguée dans l'historique avec les coûts associés.

## 3. Pré-requis

- **Articles configurés** : Les produits (PF) ou semi-finis (SF) doivent avoir une **Composition** (BOM) enregistrée.
- **Stock disponible** : Les matières premières doivent être en stock (via Achats ou Stock Initial).
- **Fonction SQL** : La fonction `perform_product_assembly` doit être déployée sur votre instance Supabase.

## 4. Guide d'Utilisation

### Étape 1 : Lancer une Production
1.  Allez dans `/dashboard/production`.
2.  Cliquez sur **"Nouvelle Production"**.
3.  Recherchez l'article à fabriquer (Produit Fini ou Semi-Fini).
4.  Saisissez la **quantité souhaitée**.

### Étape 2 : Analyse de la Recette
- Le système affiche la liste des composants nécessaires.
- Un indicateur **Vert (OK)** ou **Rouge (Manque)** vous informe de la faisabilité selon le stock actuel.
- Si un composant manque, le bouton "Confirmer" est bloqué.

### Étape 3 : Validation
- En cliquant sur "Confirmer", le stock est mis à jour instantanément.
- L'historique s'affiche dans le tableau principal, montrant la valorisation (Coût de revient x Quantité).

## 5. Cas Particulier : Semi-Finis
Les articles de type "Semi-Fini" peuvent être produits puis stockés, pour être ensuite utilisés comme composants dans d'autres produits finis (ex: une sauce produite en vrac, stockée, puis mise en bouteille).
