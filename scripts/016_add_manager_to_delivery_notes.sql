-- Add manager_name and show_manager_name columns to delivery_notes table
ALTER TABLE delivery_notes 
ADD COLUMN IF NOT EXISTS manager_name TEXT,
ADD COLUMN IF NOT EXISTS show_manager_name BOOLEAN DEFAULT FALSE;
