-- Inspect specific BL and its payments
SELECT 
    id, 
    delivery_note_number, 
    total_ttc, 
    created_at, 
    delivery_date, 
    status, 
    invoice_id, 
    is_valued
FROM delivery_notes 
WHERE id = '8c4e6ff2-bda3-4aa2-9bc2-58f9f6116b14';

SELECT 
    id, 
    amount, 
    payment_date, 
    created_at, 
    payment_method, 
    notes
FROM delivery_note_payments
WHERE delivery_note_id = '8c4e6ff2-bda3-4aa2-9bc2-58f9f6116b14';
