-- Add default_withholding_tax_rate column to companies table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'companies'
        AND column_name = 'default_withholding_tax_rate'
    ) THEN
        ALTER TABLE companies ADD COLUMN default_withholding_tax_rate NUMERIC(5, 2) DEFAULT 0;
    END IF;
END $$;
