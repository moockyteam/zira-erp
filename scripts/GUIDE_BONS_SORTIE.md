# Guide: Page "Bons de Sortie" (Stock Issues)

Ce guide détaille le fonctionnement du module de gestion des sorties de stock exceptionnelles (`/dashboard/stock-issues`).

## 1. Vue d'ensemble

Le Bon de Sortie (BS) est utilisé pour enregistrer les diminutions de stock qui ne sont pas liées à une vente directe (Facture/BL). 
Cas d'utilisation courants :
- **Casse / Dommage** : Article endommagé en entrepôt.
- **Péremption** : Produits périmés.
- **Consommation interne** : Matériel utilisé par l'entreprise elle-même.
- **Donation / Échantillon**.

## 2. Structure des Fichiers

- **Page Liste** : `app/dashboard/stock-issues/page.tsx`
- **Composant Manager** : `components/stock-issue-manager.tsx`
- **Formulaire (Dialog)** : `components/stock-issue-form-dialog.tsx`

## 3. Fonctionnement Technique

Lorsqu'un Bon de Sortie est enregistré :
1.  Une entrée est créée dans `stock_issue_vouchers`.
2.  Des lignes sont créées dans `stock_issue_voucher_lines`.
3.  Le stock est déduit des articles concernés (généralement via un trigger en base de données).

## 4. Pré-requis Base de Données

Tables requises (voir `scripts/setup_stock_issues_table.sql`) :
1.  **`public.stock_issue_vouchers`** : En-tête (Référence, Date, Motif).
2.  **`public.stock_issue_voucher_lines`** : Articles et quantités retirés.

## 5. Guide d'Utilisation

### Étape 1 : Créer un Bon de Sortie
1.  Allez dans `/dashboard/stock-issues`.
2.  Cliquez sur **"Nouveau Bon de Sortie"**.
3.  Une **Référence** est suggérée automatiquement (modifiable).
4.  Saisissez le **Motif** (ex: "Inventaire - Écart constaté").

### Étape 2 : Ajouter des Articles
1.  Recherchez l'article par nom ou référence dans la boîte de recherche.
2.  Le stock actuel s'affiche pour vous éviter de sortir plus que disponible.
3.  Saisissez la quantité et cliquez sur **"Ajouter"**.
4.  Vous pouvez ajouter plusieurs articles au même bon.

### Étape 3 : Consultation et Impression
- L'historique permet de retrouver tous les documents passés.
- Vous pouvez prévisualiser ou imprimer le Bon de Sortie pour archive physique.
