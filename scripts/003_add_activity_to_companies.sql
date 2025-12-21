-- Add activity column to companies table
-- Categories: 'commercial', 'service', 'industriel', 'extractive'

ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS activity TEXT CHECK (activity IN ('commercial', 'service', 'industriel', 'extractive'));
