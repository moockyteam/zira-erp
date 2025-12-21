-- Add manager_name column to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS manager_name TEXT;
