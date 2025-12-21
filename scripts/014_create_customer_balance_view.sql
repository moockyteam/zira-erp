-- Create a View that includes the calculated balance
-- This avoids the need for triggers and stored columns
DROP VIEW IF EXISTS customers_with_balance;

CREATE VIEW customers_with_balance AS
SELECT 
    c.*,
    (
        SELECT COALESCE(SUM(i.amount_due), 0)
        FROM invoices_with_totals i
        WHERE i.customer_id = c.id
        AND i.status NOT IN ('BROUILLON', 'ANNULEE')
    ) as calculated_balance
FROM customers c;
