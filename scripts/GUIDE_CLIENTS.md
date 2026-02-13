# Guide: Page "Clients"

Ce guide explique comment fonctionne le module de gestion des clients (`/dashboard/customers`).

## 1. Vue d'ensemble

Le module Clients permet de gérer l'ensemble de votre base de données clients (B2B et B2C). Il centralise :
- **Informations d'identité & Contact**
- **Adresses multiples** (Livraison, Facturation)
- **Conditions financières** (Solde, TVA, Tarifs spéciaux)
- **Historique** des transactions

## 2. Structure des Fichiers

- **Page Principale** : `app/dashboard/customers/page.tsx`
    - Affiche la liste des clients via `components/customer-manager.tsx`.
- **Création/Édition** : `app/dashboard/customers/new/page.tsx` et `[id]/page.tsx`
    - Utilise `components/customers/customer-form.tsx` pour le formulaire multi-onglets.
- **Paiement Global** : `components/customers/global-payment-dialog.tsx`
    - Gère les encaissements ou avoirs libres.

## 3. Pré-requis Base de Données

Les tables suivantes sont nécessaires (voir `scripts/setup_customers_table.sql`) :

1.  **`public.customers`** : Table principale.
2.  **`public.customer_addresses`** : Adresses liées (1-N).
3.  **`public.customer_items`** : Tarifs préférentiels par client (1-N).

*(Note : Des fonctions RPC Supabase comme `record_global_payment` et `calculate_customer_balance` sont également utilisées pour la gestion financière avancée).*

## 4. Guide d'Utilisation

### Étape 1 : Création d'un Client
Accédez à `/dashboard/customers/new`.

#### Onglet "Informations Générales"
- **Identité** : Nom (obligatoire), Matricule Fiscal (pour B2B), Type (Entreprise/Particulier).
- **Financier** :
    - *Solde Initial* : Reportez ici les dettes antérieures si vous migrez d'un autre système.
    - *Assujetti TVA* : Décochez pour les clients exonérés.

#### Onglet "Adresses"
- Ajoutez autant d'adresses que nécessaire.
- Définissez une **adresse par défaut** qui apparaîtra automatiquement sur les factures.

#### Onglet "Tarifs & Abonnements"
- Permet de définir un prix spécifique pour un Service ou un Produit uniquement pour ce client.
- Utile pour les contrats cadres ou offres spéciales.

### Étape 2 : Gestion Quotidienne

- **Liste** : Filtrez par nom, matricule ou email. Le solde actuel est affiché en temps réel.
    - *Rouge* : Le client vous doit de l'argent.
    - *Vert* : Vous devez de l'argent au client (Avoir/Avance).
- **Paiement Global** : Utilisez l'icône "Carte de crédit" dans la liste pour enregistrer un paiement libre (non lié à une facture spécifique au moment de la saisie, mais alloué selon la logique FIFO).

## 5. Dépannage

- **Solde incorrect** : Le solde est un champ calculé. Lancez une vérification si nécessaire (si une fonction de maintenance existe).
- **Export Excel** : Le bouton "Exporter" génère un fichier `.xlsx` de la vue actuelle.
