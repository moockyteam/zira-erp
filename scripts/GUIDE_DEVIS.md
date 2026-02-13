# Guide: Page "Devis"

Ce guide détaille le fonctionnement du module de gestion des devis (`/dashboard/quotes`).

## 1. Vue d'ensemble

Le module Devis permet de créer des propositions commerciales professionnelles pour vos clients ou prospects. Il gère :
- **Création rapide** : Sélection de clients existants ou saisie libre de prospects.
- **Lignes de devis** : Ajout d'articles (stock) ou de services.
- **Calculs automatiques** : HT, Remises, FODEC (si activé), TVA, Timbre fiscal.
- **Workflow** : Brouillon -> Envoyé -> Confirmé -> Facturé / Refusé.
- **Export PDF** : Génération et impression.

## 2. Structure des Fichiers

- **Page Liste** : `app/dashboard/quotes/page.tsx`
    - Affiche la liste avec filtres et KPIs (`components/quotes/quote-list.tsx`).
- **Page Éditeur** : `app/dashboard/quotes/[quoteId]/page.tsx`
    - Formulaire complet de création/édition (`components/quotes/quote-form.tsx`).
- **Actions** : `components/quotes/quote-actions.tsx`
    - Menu contextuel pour changer le statut, imprimer, transformer en facture.

## 3. Pré-requis Base de Données

Les tables suivantes sont nécessaires (voir `scripts/setup_quotes_table.sql`) :

1.  **`public.quotes`** : Table des entêtes de devis.
2.  **`public.quote_lines`** : Table des lignes de devis.
3.  **`public.company_defaults`** : Stockage des conditions générales par défaut.
4.  **Edge Function** : `get-next-quote-number` est requise pour générer la numérotation automatique (ex: DEVIS-2024-001).

## 4. Guide d'Utilisation

### Étape 1 : Créer un Devis
Bouton "Nouveau Devis".

#### A. Émetteur & Client
- **Émetteur** : Votre entreprise (pré-sélectionnée).
- **Client** :
    - Sélectionnez un client existant (les champs se remplissent).
    - OU saisissez un "Prospect" manuellement (Nom, Adresse...).

#### B. Articles & Chiffrage
- **Ajout de ligne** : Sélectionnez un Service ou un Article.
- **Prix & Qté** : Modifiables à la volée.
- **TVA** : taux par ligne (19%, 13%, 7%, 0%).
- **Options** : Activez/Désactivez la colonne "Remise" ou le "Timbre Fiscal" via les switchs.

#### C. Validation
- Cliquez sur "Créer le Devis".
- Le statut initial est "BROUILLON".

### Étape 2 : Cycle de Vie

Utilisez le menu "..." sur la liste ou dans le devis :
1.  **Imprimer** : Génère le PDF pour l'envoyer au client.
2.  **Marquer comme Envoyé** : Indique que le client a reçu l'offre.
3.  **Confirmer** : Le client a accepté.
    - Déclenche la possibilité de **Convertir en Facture** ou **Bon de Livraison**.
4.  **Refuser** : L'offre est rejetée.

## 5. Points Techniques Importants

- **Calculs** : Les totaux (HT, TTC) sont recalculés à chaque sauvegarde pour garantir la cohérence.
- **Numérotation** : Gérée par le backend (Supabase Edge Function) pour éviter les doublons.
- **Provisions** : Les devis ne décrémentent PAS le stock (seuls les Bons de Livraison ou Factures le font).
