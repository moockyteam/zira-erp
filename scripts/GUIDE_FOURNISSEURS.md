# Guide: Page "Fournisseurs"

Ce guide détaille le fonctionnement du module de gestion des fournisseurs (`/dashboard/suppliers`).

## 1. Vue d'ensemble

Le module Fournisseurs permet de :
- Centraliser les coordonnées et informations financières de vos partenaires.
- Classer les fournisseurs par **Catégories** et **Sous-catégories**.
- Suivre le **Solde** (Dettes envers les fournisseurs).
- **Importer** des listes existantes via Excel.

## 2. Structure des Fichiers

- **Page Principale** : `app/dashboard/suppliers/page.tsx`
    - Charge les entreprises et appelle le gestionnaire.
- **Gestionnaire** : `components/supplier-manager.tsx`
    - Contient la logique de liste, filtrage, création et édition (Dialog).
- **Import** : `components/supplier-import-dialog.tsx`
    - Gère l'importation en masse depuis un fichier Excel.

## 3. Pré-requis Base de Données

Les tables suivantes sont nécessaires (voir `scripts/setup_suppliers_table.sql`) :

1.  **`public.supplier_categories`** : Table récursive pour catégories et sous-catégories.
2.  **`public.suppliers`** : Informations détaillées des fournisseurs.

## 4. Guide d'Utilisation

### Étape 1 : Créer des Catégories (Optionnel)
Dans le formulaire de fournisseur, cliquez sur le "+" à côté de "Catégorie".
- Créez des catégories mères (ex: "Matière Première", "Services").
- Créez des sous-catégories si nécessaire.

### Étape 2 : Ajouter un Fournisseur
Bouton "Nouveau fournisseur".
- **Identité** : Nom, Matricule Fiscal (essentiel pour la facturation).
- **Contact** : Email, Téléphone, Personne à contacter.
- **Finances** :
    - *IBAN/Banque* : Pour préparer vos virements.
    - *Solde Initial* : Si vous avez déjà une dette envers ce fournisseur, saisissez-la ici.

### Étape 3 : Gestion & Export
- Utilisez les filtres pour retrouver rapidement un fournisseur par nom ou catégorie.
- **Modèle Excel** : Téléchargez le modèle pour remplir vos fournisseurs en masse et les réimporter via le bouton d'import.
