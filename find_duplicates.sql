-- Diagnostic Script: Find Double Allocations
-- We look for documents (Invoices or BLs) that have multiple "Alloc. Auto" payments
-- created at nearly the same time (within 1 second) with similar amounts.

SELECT 
    'DELIVERY_NOTE' as doc_type,
    p.delivery_note_id as doc_id,
    dn.delivery_note_number as reference,
    p.amount,
    p.payment_date,
    p.created_at,
    COUNT(*) as count
FROM delivery_note_payments p
JOIN delivery_notes dn ON p.delivery_note_id = dn.id
WHERE p.notes LIKE '%(Alloc. Auto)%'
GROUP BY p.delivery_note_id, dn.delivery_note_number, p.amount, p.payment_date, p.created_at
HAVING COUNT(*) > 1

UNION ALL

SELECT 
    'INVOICE' as doc_type,
    p.invoice_id as doc_id,
    i.invoice_number as reference,
    p.amount,
    p.payment_date,
    p.created_at,
    COUNT(*) as count
FROM invoice_payments p
JOIN invoices i ON p.invoice_id = i.id
WHERE p.notes LIKE '%(Alloc. Auto)%'
GROUP BY p.invoice_id, i.invoice_number, p.amount, p.payment_date, p.created_at
HAVING COUNT(*) > 1;
