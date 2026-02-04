# Instructions: Corriger le Calcul des Soldes Clients

## Étape 1: Exécuter le SQL dans Supabase

1. **Ouvrir Supabase Dashboard**
   - Aller sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Sélectionner votre projet

2. **Ouvrir le SQL Editor**
   - Dans le menu de gauche, cliquer sur **SQL Editor**
   - Cliquer sur **New query**

3. **Copier et coller le SQL suivant**:

```sql
CREATE OR REPLACE FUNCTION calculate_customer_balance(p_customer_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_balance NUMERIC := 0;
    v_initial_balance NUMERIC := 0;
    v_invoices NUMERIC := 0;
    v_bls NUMERIC := 0;
    v_invoice_payments NUMERIC := 0;
    v_bl_payments NUMERIC := 0;
    v_credits NUMERIC := 0;
BEGIN
    -- Initial Balance
    SELECT COALESCE(initial_balance, 0) INTO v_initial_balance
    FROM customers WHERE id = p_customer_id;
    
    -- Invoices (excluding BROUILLON and ANNULEE)
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_invoices
    FROM invoices 
    WHERE customer_id = p_customer_id 
    AND status NOT IN ('BROUILLON', 'ANNULEE');
    
    -- BLs (Unbilled only - LIVRE status and not yet invoiced)
    SELECT COALESCE(SUM(total_ttc), 0) INTO v_bls
    FROM delivery_notes 
    WHERE customer_id = p_customer_id 
    AND status = 'LIVRE' 
    AND invoice_id IS NULL;
    
    -- Invoice Payments (via invoice relationship)
    SELECT COALESCE(SUM(ip.amount), 0) INTO v_invoice_payments
    FROM invoice_payments ip
    JOIN invoices i ON ip.invoice_id = i.id
    WHERE i.customer_id = p_customer_id;
    
    -- BL Payments (via delivery_note relationship)
    SELECT COALESCE(SUM(dnp.amount), 0) INTO v_bl_payments
    FROM delivery_note_payments dnp
    JOIN delivery_notes dn ON dnp.delivery_note_id = dn.id
    WHERE dn.customer_id = p_customer_id;
    
    -- Customer Credits (direct payments/avances)
    SELECT COALESCE(SUM(amount), 0) INTO v_credits
    FROM customer_credits 
    WHERE customer_id = p_customer_id;
    
    -- Calculate final balance
    -- NOTE: We DO NOT include global_payment_entries to avoid double-counting
    -- as those payments are already recorded in invoice_payments and delivery_note_payments
    v_balance := v_initial_balance + v_invoices + v_bls 
                - v_invoice_payments - v_bl_payments - v_credits;
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;
```

4. **Exécuter la requête**
   - Cliquer sur **Run** ou appuyer sur `Ctrl+Enter`
   - Vous devriez voir: "Success. No rows returned"

## Étape 2: Recalculer tous les soldes

Après avoir mis à jour la fonction, exécuter le script Node.js suivant:

```bash
node recalculate_balances.js
```

Ce script va:
1. Récupérer tous les clients
2. Recalculer le solde de chaque client avec la nouvelle fonction
3. Mettre à jour la colonne `balance` dans la table `customers`
4. Afficher un rapport des changements

## Vérification

Après l'exécution, vérifier que:
- ✅ Les soldes affichés dans `/dashboard/customers` correspondent
- ✅ Les soldes dans `/dashboard/customers/[id]` (onglet Historique) correspondent
- ✅ Les soldes dans `/dashboard/global-collections` correspondent

## Qu'est-ce qui a été corrigé?

**Avant**: La fonction incluait probablement `global_payment_entries`, ce qui causait un **double comptage** des paiements (car ces entrées dupliquent déjà `invoice_payments` et `delivery_note_payments`).

**Après**: La fonction utilise uniquement:
- `invoice_payments` (payements liés aux factures)
- `delivery_note_payments` (paiements liés aux BL)
- `customer_credits` (avances/crédits directs)

**Formule finale**:
```
Balance = initial_balance 
        + Factures (non annulées) 
        + BL livrés non facturés
        - Paiements factures
        - Paiements BL
        - Crédits client
```
