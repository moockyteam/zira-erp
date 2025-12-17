-- Add currency column to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TND' CHECK (currency IN ('TND', 'USD', 'EUR'));

-- Add currency column to quotes table
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TND' CHECK (currency IN ('TND', 'USD', 'EUR'));

-- Update existing records to have TND as default currency
UPDATE invoices SET currency = 'TND' WHERE currency IS NULL;
UPDATE quotes SET currency = 'TND' WHERE currency IS NULL;
