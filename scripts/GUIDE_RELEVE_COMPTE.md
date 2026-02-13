# Guide: Page "Relevé de Compte" (Global Collections)

Ce guide explique le fonctionnement du module de suivi global des comptes clients (`/dashboard/global-collections`).

## 1. Vue d'ensemble

La page **Relevé de Compte** (Global Collections) offre une vue consolidée de la situation financière d'un client. Contrairement à la liste des factures, elle présente un historique chronologique de tous les mouvements :
- **Débits** : Ce que le client vous doit (Factures, BL non facturés, Solde initial).
- **Crédits** : Ce que le client a payé (Paiements, Avoirs, Avances).

Elle permet de répondre instantanément à la question : "Combien me doit exactement ce client à ce jour ?".

## 2. Structure des Fichiers

- **Page Principale** : `app/dashboard/global-collections/page.tsx`
- **Manager de Relevé** : `components/payments/global-collections-manager.tsx`

## 3. Fonctionnement du Relevé (Tab "Mouvements")

Le relevé agrège les données de plusieurs tables pour construire le grand livre du client :
1.  **Solde Initial** : Défini sur la fiche client pour reprendre les dettes historiques.
2.  **Factures** : Toute facture validée (statut non brouillon/annulé) augmente la dette.
3.  **BL non facturés** : Les bons de livraison livrés mais pas encore convertis en facture sont inclus pour refléter le stock réellement sorti.
4.  **Paiements** : Tous les règlements liés à des factures ou des BL diminuent la dette.
5.  **Crédits/Avances** : Les paiements "en trop" ou les avoirs diminuent la dette globale.

## 4. Gestion des Paiements Globaux (Tab "Paiements")

Cette section permet une gestion fine des transactions financières passées :
- **Consultation** : Voyez exactement comment un paiement global a été ventilé entre les différentes factures et BL.
- **Modification** : Si un montant a été mal saisi, vous pouvez le modifier. Le système recalculera alors automatiquement l'allocation (FIFO).
- **Suppression** : Supprime un paiement et restaure la dette sur les documents originaux.

## 5. Guide d'Utilisation

### Étape 1 : Consulter un relevé
1.  Sélectionnez un **Client** dans la liste déroulante.
2.  Consultez les cartes de synthèse (Total Facturé, Total Payé, Reste à Payer).
3.  Utilisez le tri (Ancien → Récent ou inversement) pour analyser l'évolution du solde.

### Étape 2 : Imprimer / Exporter
1.  Cliquez sur le bouton **"Imprimer"**.
2.  Une vue optimisée pour l'impression s'affiche, prête à être envoyée au client pour relance ou vérification de solde.

### Étape 3 : Gérer les erreurs
Si vous remarquez un paiement erroné dans le relevé, passez sur l'onglet **"Historique des Paiements Globaux"** pour le modifier ou le supprimer.
