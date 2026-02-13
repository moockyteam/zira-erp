# Guide: Page "Factures"

Ce guide détaille le fonctionnement du module de facturation (`/dashboard/invoices`).

## 1. Vue d'ensemble

Le module Factures est le cœur de la gestion financière. Il permet de :
- **Créer des factures** (manuelles ou depuis Devis/BL).
- **Suivre les paiements** (partiels ou totaux).
- **Contrôler les échus** (factures en retard).
- **Gérer la retenue à la source** et le timbre fiscal.
- **Exporter** en PDF ou Excel.

## 2. Structure des Fichiers

- **Page Liste** : `app/dashboard/invoices/page.tsx`
    - Affiche la liste via `components/invoices/invoice-list.tsx`.
    - Utilise la vue SQL `invoices_with_totals` pour la performance (calcul du "reste à payer").
- **Page Éditeur** : `app/dashboard/invoices/[invoiceId]/page.tsx`
    - Formulaire via `components/invoices/invoice-form.tsx`.
- **Paiements** : `components/invoices/payment-dialog.tsx`
    - Modal pour enregistrer un encaissement.

## 3. Pré-requis Base de Données

Les tables suivantes sont nécessaires (voir `scripts/setup_invoices_table.sql`) :

1.  **`public.invoices`** : Entêtes des factures.
2.  **`public.invoice_lines`** : Lignes produits/services.
3.  **`public.invoice_payments`** : Historique des paiements reçus.
4.  **`public.invoices_with_totals`** : **VUE SQL CRITIQUE**. Elle calcule dynamiquement `total_paid` et `amount_due` pour chaque facture. Sans elle, la liste ne charge pas.

**Fonctions RPC requises :**
- `get-next-invoice-number` : Génération séquencielle (FAC-2024-XXX).
- `record_payment` : Fonction pour insérer un paiement et mettre à jour le statut de la facture automatiquement.

## 4. Guide d'Utilisation

### Étape 1 : Créer une Facture
- **Depuis Zéro** : Bouton "Créer une facture".
- **Depuis un Devis** : Ouvrez un Devis validé -> "Convertir en Facture".
- **Depuis un BL** : Ouvrez un BL -> "Facturer".

*Note : La création depuis un BL transfère automatiquement les paiements déjà reçus sur le BL vers la facture.*

### Étape 2 : Options Financières
Dans le formulaire :
- **Timbre Fiscal** : Activé par défaut (1.000 TND).
- **Retenue à la Source (RS)** : Activez le switch si le client applique une RS. Le taux par défaut est récupéré de la configuration de l'entreprise.
- **TVA & FODEC** : Calculés automatiquement selon les articles et la configuration entreprise.

### Étape 3 : Enregistrement des Paiements
Une fois la facture créée (Statut "ENVOYE") :
1.  Cliquez sur l'icône "Carte Bancaire" dans la liste.
2.  Saisissez le montant, la date et le mode (Chèque, Espèces, Virement).
3.  Le statut se met à jour :
    - **PARTIELLEMENT PAYEE** : Si Montant Versé < Total TTC.
    - **PAYEE** : Si Montant Versé = Total TTC.

## 5. Dépannage
- **Champs manquants** : Si la liste ne s'affiche pas, vérifiez que la vue `invoices_with_totals` existe bien.
- **Erreur RPC** : Si le paiement échoue, vérifiez que la fonction `record_payment` est déployée sur Supabase.
