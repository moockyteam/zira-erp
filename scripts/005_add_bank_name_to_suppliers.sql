-- Add bank_name column to suppliers table
ALTER TABLE suppliers
ADD COLUMN bank_name TEXT;

-- Comment on column
COMMENT ON COLUMN suppliers.bank_name IS 'Name of the bank associated with the supplier';
