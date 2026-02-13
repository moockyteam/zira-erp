# Guide: Page "Services"

Ce guide explique comment fonctionne la page de gestion des services (`/dashboard/services`) et comment la configurer.

## 1. Vue d'ensemble

Cette page permet de gérer le catalogue de prestations de services de l'entreprise. Elle offre des fonctionnalités pour :
- Créer et modifier des services.
- Définir des modèles de tarification variés (Forfait, Taux horaire, Abonnement).
- Organiser les services par catégories.
- Filtrer et rechercher rapidement dans le catalogue.

## 2. Structure des Fichiers

- **Page Principale** : `app/dashboard/services/page.tsx`
    - Point d'entrée, charge les entreprises de l'utilisateur.
- **Gestionnaire** : `components/services/service-manager.tsx`
    - Composant principal, gère la liste, les filtres et l'état global.
- **Liste** : `components/services/service-list.tsx`
    - Affichage des services (Grid/List view).
- **Dialogue** : `components/services/service-dialog.tsx`
    - Formulaire de création/édition avec onglets (Identification, Tarification).

## 3. Pré-requis Base de Données

Les tables suivantes sont nécessaires (voir `scripts/setup_services_table.sql`) :

1.  **`public.services`** : Table principale des services.
2.  **`public.service_categories`** : Table des catégories (Système ou par Entreprise).

## 4. Guide d'Utilisation

### Étape 1 : Création d'un Service
Cliquez sur le bouton "Nouveau Service".

#### Onglet "Identification"
- **Nom** : Libellé du service (ex: "Développement Web").
- **SKU** : Code unique ou référence interne.
- **Catégorie** : Pour grouper vos services (ex: "Consulting", "Maintenance").
- **Description** :
    - *Courte* : Apparaît dans les listes.
    - *Détaillée* : Apparaît sur les devis/factures.

#### Onglet "Tarification"
- **Type de facturation** :
    - *Forfait* : Prix fixe pour une prestation.
    - *Taux Horaire* : Prix par heure.
    - *Taux Journalier* : Prix par jour.
    - *Abonnement* : Mensuel ou Annuel.
- **Devise & TVA** : Choisissez la devise (TND, EUR, USD) et le taux de TVA applicable.
- **Prix HT** : Saisissez le montant HT, le TTC est calculé automatiquement (et inversement).

### Étape 2 : Gestion et Filtres
Utilisez la barre d'outils pour :
- **Rechercher** par nom ou SKU.
- **Filtrer par Type** : Afficher uniquement les abonnements, par exemple.
- **Filtrer par Devise**.
- **Modifier/Supprimer** : Via le menu d'actions sur chaque carte de service.

## 5. Dépannage Technique

- **Catégories manquantes** : Assurez-vous que la table `service_categories` contient des données ou que l'utilisateur en a créé.
- **Problèmes de calcul TTC** : Le calcul est fait en temps réel côté client (JS), assurez-vous que le taux de TVA est correct.
