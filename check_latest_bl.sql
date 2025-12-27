-- DIAGNOSE LATEST BL
-- User says: BL created, has lines, but AMOUNT is 0.00.

WITH latest_bl AS (
    SELECT id, delivery_note_number, total_ttc, status, created_at
    FROM delivery_notes
    ORDER BY created_at DESC
    LIMIT 1
)
SELECT 
    bl.delivery_note_number,
    bl.total_ttc as stored_header_total,
    bl.status,
    (SELECT COUNT(*) FROM delivery_note_lines WHERE delivery_note_id = bl.id) as line_count,
    (SELECT SUM(quantity * unit_price_ht) FROM delivery_note_lines WHERE delivery_note_id = bl.id) as sum_lines_ht
FROM latest_bl bl;
