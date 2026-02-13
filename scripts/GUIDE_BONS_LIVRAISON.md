# Guide: Page "Bons de Livraison" (Delivery Notes)

Ce guide détaille le fonctionnement du module de gestion des Bons de Livraison (`/dashboard/delivery-notes`).

## 1. Vue d'ensemble

Le Bon de Livraison (BL) formalise la sortie physique des marchandises chez le client. Il permet de :
- Confirmer ce qui a été effectivement livré.
- Gérer les informations de transport (Chauffeur, Camion).
- Suivre les paiements reçus avant la facturation (ex: paiement à la livraison).
- **Convertir en Facture** ultérieurement.

## 2. Structure des Fichiers

- **Page Liste** : `app/dashboard/delivery-notes/page.tsx`
- **Composant Liste** : `components/delivery-notes/delivery-note-list.tsx`
- **Formulaire** : `components/delivery-notes/delivery-note-form.tsx`
- **Actions (Impression, Facturation)** : `components/delivery-notes/delivery-note-actions.tsx`
- **Paiements** : `components/delivery-notes/delivery-note-payment-dialog.tsx`

## 3. Flux de Travail et Statuts

### Statuts du BL
- **BROUILLON** : En cours de préparation. Ne déduit pas encore le stock.
- **LIVRE** : Marchandise sortie. Confirme la vente. 
- **ANNULE** : Annulation de la livraison.

### Processus de Facturation
Un BL peut être transformé en facture à tout moment via le bouton **"Facturer"**. 
Cela crée une nouvelle facture pré-remplie avec les lignes du BL et lie les deux documents (`delivery_notes.invoice_id`).

## 4. Pré-requis Base de Données

Tables requises (voir `scripts/setup_delivery_notes_table.sql`) :
1.  **`public.delivery_notes`** : En-tête du document.
2.  **`public.delivery_note_lines`** : Articles livrés.
3.  **`public.delivery_note_payments`** : Historique des paiements liés directement au BL.

**Fonctionnalités avancées :**
- La numérotation automatique est gérée par une Edge Function `get-next-delivery-note-number`.

## 5. Guide d'Utilisation

### Étape 1 : Créer un Nouveau BL
1.  Cliquez sur **"Nouveau BL"**.
2.  Sélectionnez le **Client**. L'adresse de livraison est récupérée automatiquement.
3.  Ajoutez les articles.
4.  Renseignez les infos transport (Chauffeur/Camion) si nécessaire.
5.  Activez l'option **"Valorisée ?"** si vous souhaitez afficher les prix sur le document imprimé.

### Étape 2 : Validation et Paiement
- Une fois livré, passez le statut à **LIVRE**.
- Si le client paie à la livraison (Espèces/Chèque), enregistrez le montant via le bouton **"Paiement"**.

### Étape 3 : Conversion en Facture
À la fin du mois ou selon votre accord, cliquez sur **"Facturer"** dans la liste des BLs. Le système vous redirigera vers le formulaire de facture pré-rempli.
Une fois la facture créée, le BL sera marqué comme **"FACTURÉ"** dans la liste.
