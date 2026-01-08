-- =====================================================
-- DIAGNOSTIC APPROFONDI - Paiements du 2026-01-05
-- =====================================================

-- 1. Détail des 3 paiements du 05/01 avec ESPECES
SELECT 
    dp.id,
    dp.payment_date,
    dp.amount,
    dp.payment_method,
    dp.notes,
    dp.created_at as payment_created_at,
    dn.delivery_note_number,
    dn.delivery_date,
    dn.created_at as bl_created_at,
    dn.total_ttc,
    dn.status
FROM delivery_note_payments dp
JOIN delivery_notes dn ON dp.delivery_note_id = dn.id
WHERE dn.customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'
  AND DATE(dp.payment_date) = '2026-01-05'
ORDER BY dp.created_at ASC;

-- 2. Vérifier l'état de BL-2026-013 le 05/01
-- (pourquoi n'a-t-il pas reçu de paiement?)
SELECT 
    id,
    delivery_note_number,
    delivery_date,
    created_at,
    status,
    is_valued,
    total_ttc,
    invoice_id
FROM delivery_notes 
WHERE id = 'f225df95-f1ca-4c3f-acf1-74f3b07180c6';

-- 3. Tous les paiements sur BL-2026-013
SELECT 
    dp.id,
    dp.payment_date,
    dp.amount,
    dp.payment_method,
    dp.created_at
FROM delivery_note_payments dp
WHERE dp.delivery_note_id = 'f225df95-f1ca-4c3f-acf1-74f3b07180c6'
ORDER BY dp.created_at;

-- 4. Reconstruction: état des BL au moment du paiement du 05/01
-- On veut voir quels BLs existaient et leur solde restant AVANT le paiement
WITH payment_sums AS (
    SELECT 
        dn.id,
        dn.delivery_note_number,
        dn.delivery_date,
        dn.total_ttc,
        dn.status,
        dn.is_valued,
        dn.created_at as bl_created,
        COALESCE(SUM(CASE WHEN dp.payment_date < '2026-01-05' THEN dp.amount ELSE 0 END), 0) as paid_before_0105,
        dn.total_ttc - COALESCE(SUM(CASE WHEN dp.payment_date < '2026-01-05' THEN dp.amount ELSE 0 END), 0) as balance_on_0105
    FROM delivery_notes dn
    LEFT JOIN delivery_note_payments dp ON dn.id = dp.delivery_note_id
    WHERE dn.customer_id = 'd75a5346-121f-40c0-a5ac-2ac824c8de6a'
      AND dn.status = 'LIVRE'
      AND dn.invoice_id IS NULL
    GROUP BY dn.id
)
SELECT * FROM payment_sums
WHERE balance_on_0105 > 0.01
ORDER BY delivery_date ASC, bl_created ASC;

-- 5. Question clé: Le created_at du BL-2026-018 vs les paiements
SELECT 
    'BL-2026-018' as item,
    created_at
FROM delivery_notes 
WHERE delivery_note_number = 'BL-2026-018'
UNION ALL
SELECT 
    'Payment on BL-2026-018',
    dp.created_at
FROM delivery_note_payments dp
JOIN delivery_notes dn ON dp.delivery_note_id = dn.id
WHERE dn.delivery_note_number = 'BL-2026-018';
