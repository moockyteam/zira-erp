# Guide: Page "Gestion des Encaissements" (Payments)

Ce guide explique le fonctionnement du module de gestion des paiements clients (`/dashboard/payments`).

## 1. Vue d'ensemble

Le module Paiements est le cœur financier de l'ERP. Il utilise une logique de **paiement global** : au lieu de payer chaque facture une par une, vous enregistrez le montant reçu du client, et le système l'alloue automatiquement aux documents impayés (Factures et BL) selon la méthode **FIFO** (le plus ancien d'abord).

## 2. Concepts Clés

- **Encaissement Global** : Un seul paiement peut couvrir plusieurs factures et plusieurs bons de livraison.
- **Allocation FIFO** : Le système cherche automatiquement les dettes les plus anciennes du client pour les solder en priorité.
- **Crédit Client** : Si le client paie plus que ce qu'il doit, le surplus est stocké comme un crédit (avance) et sera automatiquement utilisé pour ses prochaines factures.
- **Avoirs** : Vous pouvez enregistrer des avoirs qui diminuent la dette du client sans mouvement d'argent réel (ex: remise après-vente).

## 3. Structure des Fichiers

- **Page Principale** : `app/dashboard/payments/page.tsx`
- **Manager de Paiements** : `components/payments/payment-manager.tsx`
- **Formulaire d'Encaissement** : `components/payments/global-payment-form.tsx`
- **Historique** : `components/payments/payment-history-list.tsx`

## 4. Guide d'Utilisation

### Étape 1 : Enregistrer un Paiement
1.  Allez dans `/dashboard/payments`.
2.  Dans le formulaire à gauche, sélectionnez le **Client**.
3.  Le **Solde actuel** du client s'affiche (positif s'il vous doit de l'argent, négatif s'il est en crédit).
4.  Saisissez le **Montant** et le **Mode de paiement** (Chèque, Espèces, etc.).
5.  Cliquez sur **"Enregistrer le Paiement"**.

### Étape 2 : Visualiser l'Allocation
Une fois enregistré, un récapitulatif s'affiche :
- Il montre exactement quel montant a été alloué à quelle Facture ou quel BL.
- Il indique si un montant est resté "en crédit" pour le futur.

### Étape 3 : Historique et Analyse
- Le tableau à droite liste tous les paiements passés.
- En cliquant sur un client, vous accédez à sa fiche de paiement personnalisée (`CustomerPaymentOverview`) qui montre l'état de son compte.

## 5. Cas Particulier : Les Avoirs
Si vous devez accorder une réduction à posteriori ou gérer un retour sans BR, utilisez l'onglet **"Avoir / Avance"**. Cela réduit le solde du client de la même manière qu'un paiement, mais avec le libellé "AVOIR".
