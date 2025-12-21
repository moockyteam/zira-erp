-- Add special_vat_rate column to customer_items
ALTER TABLE customer_items 
ADD COLUMN IF NOT EXISTS special_vat_rate DECIMAL(5, 2);

-- Comment: special_vat_rate can be NULL. If NULL, the document logic should use the item's default VAT rate.
