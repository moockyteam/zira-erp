-- AUDIT COMPLET POUR : d75a5346-121f-40c0-a5ac-2ac824c8de6a
-- Exécutez ce script pour voir 3 résultats différents (onglets) en bas de page.

-- 1. IDENTIFICATION ET SOLDE STOCKÉ
SELECT 
    id, 
    name as "Nom (Client/Entreprise)", 
    'Customer' as "Type Entite",
    initial_balance as "Solde Initial",
    balance_start_date as "Date Debut Solde",
    balance as "Solde Actuel Stocke"
FROM public.customers 
WHERE id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'
UNION ALL
SELECT 
    id, 
    name, 
    'Company' as "Type Entite",
    NULL, NULL, NULL
FROM public.companies 
WHERE id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a';

-- 2. RÉCAPITULATIF CALCULÉ (VRAI SOLDE THÉORIQUE)
-- Ce tableau recalcule tout depuis zéro pour trouver l'erreur.
WITH params AS (
    SELECT 
        id, 
        COALESCE(balance_start_date, '2000-01-01') as start_date,
        COALESCE(initial_balance, 0) as init_bal
    FROM public.customers WHERE id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'
),
factures AS (
    SELECT COALESCE(SUM(total_ttc), 0) as total_inv 
    FROM public.invoices, params 
    WHERE customer_id = params.id 
    AND status NOT IN ('BROUILLON', 'ANNULEE')
    AND invoice_date >= params.start_date
),
bls AS (
    SELECT COALESCE(SUM(total_ttc), 0) as total_bl 
    FROM public.delivery_notes, params 
    WHERE customer_id = params.id 
    AND status = 'LIVRE' AND invoice_id IS NULL
    AND COALESCE(delivery_date, created_at) >= params.start_date
),
paiements_inv AS (
    SELECT COALESCE(SUM(p.amount), 0) as paid_inv 
    FROM public.invoice_payments p
    JOIN public.invoices i ON p.invoice_id = i.id, params
    WHERE i.customer_id = params.id
    AND p.payment_date >= params.start_date
),
paiements_bl AS (
    SELECT COALESCE(SUM(p.amount), 0) as paid_bl 
    FROM public.delivery_note_payments p
    JOIN public.delivery_notes dn ON p.delivery_note_id = dn.id, params
    WHERE dn.customer_id = params.id
    AND p.payment_date >= params.start_date
)
SELECT 
    p.init_bal as "1. Solde Initial",
    f.total_inv as "2. Total Facture (+)",
    b.total_bl as "3. Total BL Non-Facture (+)",
    pi.paid_inv as "4. Paye sur Factures (-)",
    pb.paid_bl as "5. Paye sur BLs (-)",
    (p.init_bal + f.total_inv + b.total_bl - pi.paid_inv - pb.paid_bl) as "6. SOLDE CALCULE (VRAI)",
    c.balance as "7. SOLDE STOCKE (ACTUEL)",
    (c.balance - (p.init_bal + f.total_inv + b.total_bl - pi.paid_inv - pb.paid_bl)) as "8. ECART (Erreur)"
FROM params p, factures f, bls b, paiements_inv pi, paiements_bl pb, public.customers c
WHERE c.id = p.id;

-- 3. HISTORIQUE DÉTAILLÉ DES OPÉRATIONS (RELEVÉ COMPLET)
-- Liste chronologique de TOUTES les opérations prises en compte
SELECT 
    invoice_date as date_op,
    'FACTURE' as type,
    invoice_number as reference,
    total_ttc as debit,
    0 as credit,
    status
FROM public.invoices
WHERE customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a' AND status NOT IN ('BROUILLON', 'ANNULEE')

UNION ALL

SELECT 
    COALESCE(delivery_date, created_at) as date_op,
    'BL' as type,
    delivery_note_number as reference,
    total_ttc as debit,
    0 as credit,
    status
FROM public.delivery_notes
WHERE customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a' AND status = 'LIVRE' AND invoice_id IS NULL

UNION ALL

SELECT 
    p.payment_date as date_op,
    'PAIEMENT (Facture)' as type,
    i.invoice_number as reference,
    0 as debit,
    p.amount as credit,
    p.payment_method
FROM public.invoice_payments p
JOIN public.invoices i ON p.invoice_id = i.id
WHERE i.customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'

UNION ALL

SELECT 
    p.payment_date as date_op,
    'PAIEMENT (BL)' as type,
    dn.delivery_note_number as reference,
    0 as debit,
    p.amount as credit,
    p.payment_method
FROM public.delivery_note_payments p
JOIN public.delivery_notes dn ON p.delivery_note_id = dn.id
WHERE dn.customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'

ORDER BY date_op DESC;
