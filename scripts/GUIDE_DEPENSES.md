# Guide: Page "Dépenses" (Expenses)

Ce guide détaille le fonctionnement du module de gestion des dépenses et des flux sortants (`/dashboard/expenses`).

## 1. Vue d'ensemble

Le module Dépenses permet de centraliser tous les coûts de l'entreprise : achats de fournitures, abonnements, loyers, salaires, etc. Il intègre une gestion avancée de la TVA tunisienne et des retenues à la source.

## 2. Structure des Fichiers

- **Page Liste** : `app/dashboard/expenses/page.tsx`
- **Formulaire (Création)** : `app/dashboard/expenses/new/page.tsx` & `components/expenses/expense-form.tsx`
- **Gestionnaire** : `components/expenses/expense-manager.tsx`
- **Récurrence** : `components/expenses/recurring-expense-manager.tsx`
- **Échéancier** : `components/expenses/expense-schedule-manager.tsx`

## 3. Fonctionnement Technique

Le système gère trois types de dépenses :
1.  **Dépense Ponctuelle** : Un achat unique (ex: Ticket de taxi).
2.  **Dépense Récurrente** : Un coût fixe qui revient périodiquement (ex: Loyer, Abonnement Internet). Une règle est créée, et le système génère les dépenses automatiquement.
3.  **Dépense Échelonnée** : Une grosse facture payée en plusieurs fois (ex: Achat de matériel payé sur 4 mois).

## 4. Pré-requis Base de Données

Tables requises (voir `scripts/setup_expenses_table.sql`) :
- `public.expense_categories` : Catégories (Loyer, Marketing, etc.).
- `public.expenses` : Les transactions réelles.
- `public.recurring_expenses` : Les règles de répétition.
- `public.expense_schedules` : Les échéances de paiement différé.

## 5. Guide d'Utilisation

### Étape 1 : Créer une Dépense
1.  Cliquez sur **"Nouvelle Dépense"**.
2.  Sélectionnez la **Catégorie** et saisissez le **Bénéficiaire**.
3.  Indiquez la **Devise** (TND par défaut).

### Étape 2 : Saisir les Montants & Taxes
- **Mode Simple** : Saisissez directement le montant TTC.
- **Mode TVA** : Activez le switch "TVA Applicable" pour décomposer par taux (19%, 13%, 7%).
- **Retenue à la Source** : Activez l'option si le prestataire y est soumis (1.5%, 15%, etc.). Le système calcule automatiquement le Net à Payer.

### Étape 3 : Gérer la Récurrence ou l'Échéancier
- Pour un abonnement, cochez **"Dépense Récurrente"** et choisissez la fréquence.
- Pour un paiement en plusieurs fois, cochez **"Paiement Échelonné"** et générez les échéances.

### Étape 4 : Justificatifs
Vous pouvez uploader un PDF ou une image de la facture. Le fichier sera stocké sur Supabase Storage.
