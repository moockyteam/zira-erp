-- VERIFY CONTEXT & RECALCULATE MANUALLY
-- Let's see why the math fails in the function.

WITH params AS (
    SELECT customer_id as target_id 
    FROM delivery_notes 
    WHERE id = '8c4e6ff2-bda3-4aa2-9bc2-58f9f6116b14'
)
SELECT 
    c.id as customer_id,
    c.name,
    c.balance as stored_balance,
    c.initial_balance,
    c.balance_start_date,
    -- Re-run the SUM logic manually here to see what SQL sees
    (SELECT SUM(total_ttc) FROM delivery_notes 
     WHERE customer_id = c.id 
       AND status = 'LIVRE' 
       AND invoice_id IS NULL 
       AND total_ttc > 0
       AND (c.balance_start_date IS NULL OR COALESCE(delivery_date, created_at::date) >= c.balance_start_date)
    ) as manual_sum_bl,
    
    -- Check if THIS specific BL is excluded by date?
    (CASE WHEN (c.balance_start_date IS NOT NULL AND '2025-12-21'::date < c.balance_start_date) 
          THEN 'EXCLUDED_BY_DATE' ELSE 'INCLUDED' END) as bl_date_check

FROM customers c
JOIN params p ON c.id = p.target_id;
