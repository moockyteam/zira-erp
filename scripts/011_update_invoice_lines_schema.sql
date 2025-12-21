-- Add service_id column to invoice_lines
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id);

-- Make item_id nullable to allow lines that are services only
ALTER TABLE invoice_lines ALTER COLUMN item_id DROP NOT NULL;

-- Add constraint to ensure either item_id or service_id is present (optional but good practice)
-- ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_item_or_service_check CHECK (item_id IS NOT NULL OR service_id IS NOT NULL);
