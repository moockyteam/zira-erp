-- Add service_id column to quote_lines table to support Services in Quotes
ALTER TABLE quote_lines 
ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id);

-- Make item_id nullable because a line can now be either an Item OR a Service
ALTER TABLE quote_lines 
ALTER COLUMN item_id DROP NOT NULL;

-- Add check constraint to ensure at least one is set (optional but good practice)
-- ALTER TABLE quote_lines ADD CONSTRAINT quote_lines_item_or_service_check CHECK (item_id IS NOT NULL OR service_id IS NOT NULL);
