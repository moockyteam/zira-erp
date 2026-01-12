-- Migration: Add 'marchandise' type to item_type_enum

-- Add the new value to the enum type
ALTER TYPE item_type_enum ADD VALUE IF NOT EXISTS 'marchandise';

-- Note: This migration adds a new stock type for trading goods (buy/sell only)
-- After running this, the available types are:
-- product: Finished products (manufactured, can have recipes)
-- marchandise: Trading goods (buy and resell, no recipe)
-- semi_finished: Semi-finished goods (can be produced, used in other recipes)
-- raw_material: Raw materials (purchased, used in production)
-- consumable: Consumables (used in production, internal use)
-- asset: Fixed assets/immobilization
