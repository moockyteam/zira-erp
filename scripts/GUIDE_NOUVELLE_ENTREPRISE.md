# Guide: Page "Nouvelle Entreprise"

Ce guide explique comment fonctionne la page de création d'entreprise (`/dashboard/companies?mode=create`) et comment la configurer.

## 1. Vue d'ensemble

Cette page permet aux utilisateurs authentifiés de créer une nouvelle entité juridique (entreprise) dans l'ERP. Elle collecte des informations essentielles telles que :
- Identité (Nom, Matricule Fiscal, Gérant)
- Contact (Email, Téléphone, Adresse)
- Localisation (Gouvernorat, Délégation)
- Paramètres Fiscaux (Assujetti ou non au FODEC, Exportateur)
- Logo

## 2. Structure des Fichiers

- **Page Principale** : `app/dashboard/companies/page.tsx`
    - Gère l'affichage conditionnel (Liste vs Création).
- **Composant Formulaire** : `components/company-manager.tsx`
    - Contient toute la logique du formulaire, la gestion d'état et les appels Supabase.

## 3. Pré-requis Base de Données

Pour que cette page fonctionne, les tables suivantes doivent exister dans Supabase.
Vous pouvez exécuter le script SQL fourni dans `scripts/setup_company_tables.sql`.

### Tables Nécessaires
1.  **`public.companies`** : Stocke les données de l'entreprise.
2.  **`public.governorates`** : Liste des gouvernorats (ex: Tunis, Ariana).
3.  **`public.delegations`** : Liste des délégations liées aux gouvernorats.
4.  **`storage.buckets`** : Un bucket nommé `company_logos` est requis pour l'upload des images.

## 4. Guide d'Utilisation (Step-by-Step)

### Étape 1 : Accès
Naviguez vers `/dashboard/companies?mode=create` ou cliquez sur le bouton "Ajouter une entreprise" depuis la liste.

### Étape 2 : Remplissage du Formulaire

#### A. Informations Générales
- **Nom de l'entreprise** : Obligatoire.
- **Matricule Fiscal** : Important pour la facturation.

#### B. Secteur d'Activité
Sélectionnez l'une des 4 options : Commerciale, Service, Industrielle, Extractive.

#### C. Localisation
- Sélectionnez d'abord le **Gouvernorat**.
- La liste des **Délégations** se mettra à jour automatiquement.

#### D. Paramètres & Logo
- **Totalement exportatrice** : Cochez si exonéré de TVA locale.
- **Soumise au FODEC** : Cochez si vous devez appliquer la taxe de 1%.
- **Logo** : Cliquez pour uploader (Max 5MB, PNG/JPG).

### Étape 3 : Validation
Cliquez sur "Ajouter l'entreprise".
- Si succès : Notification verte, redirection vers la liste.
- Si erreur : Notification rouge avec détail de l'erreur.

## 5. Dépannage Courant

- **Erreur "Rien ne se passe au clic"** : Vérifiez la console (F12) pour des erreurs JS.
- **Erreur "Permission denied"** : Vérifiez les politiques RLS dans Supabase (voir script SQL).
- **Dropdown Gouvernorat vide** : La table `governorates` est probablement vide. Importez les données géographiques.
