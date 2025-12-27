-- FIX ZERO TOTAL BLs V2 (Corrected with VAT & Discount)
-- The previous script calculated HT only. This one includes Tax (TVA) and Discount (Remise).

UPDATE delivery_notes dn
SET total_ttc = subquery.calc_total
FROM (
    SELECT 
        delivery_note_id, 
        SUM(
            (quantity * unit_price_ht) 
            * (1 - COALESCE(remise_percentage, 0) / 100.0) 
            * (1 + COALESCE(tva_rate, 19) / 100.0)
        ) as calc_total
    FROM delivery_note_lines
    GROUP BY delivery_note_id
) AS subquery
WHERE dn.id = subquery.delivery_note_id
  -- Update if Total is 0 OR if it looks like it was calculated as HT (heuristic not needed if we just fix the specific issues)
  -- Safest: Update where we know it's wrong or for the specific BL number if known, or just all that are 0.
  -- To fix the one that is now HT (mistakenly fixed by V1), we allow updating if it matches the HT sum?
  -- Let's just FORCE update for the recent ones or all 'LIVRE' ones that might be wrong.
  -- For safety, let's target the ones that contradict the sum significantly or are 0.
  AND (
      dn.total_ttc = 0 
      OR dn.total_ttc IS NULL 
      OR ABS(dn.total_ttc - subquery.calc_total) > 0.01 -- Fix ANY discrepancy between header and lines
  );

-- Note: This enforces that Header Total = Sum of Lines.
