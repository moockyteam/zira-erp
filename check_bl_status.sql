-- CHECK STATUS and INVOICE LINK
-- Why is this BL ignored?

SELECT 
    id, 
    delivery_note_number, 
    status,           -- MUST be 'LIVRE'
    invoice_id,       -- MUST be NULL
    total_ttc,        -- MUST be > 0
    created_at,
    delivery_date
FROM delivery_notes 
WHERE id = '8c4e6ff2-bda3-4aa2-9bc2-58f9f6116b14';
