-- FIX ZERO TOTAL BLs (Corrected Syntax)

UPDATE delivery_notes dn
SET total_ttc = subquery.calc_total
FROM (
    SELECT delivery_note_id, SUM(quantity * unit_price_ht) as calc_total
    FROM delivery_note_lines
    GROUP BY delivery_note_id
) AS subquery
WHERE dn.id = subquery.delivery_note_id
  AND (dn.total_ttc = 0 OR dn.total_ttc IS NULL);
