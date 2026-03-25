-- Migration: Add family_id and family_name to inventory_items
-- Run this in your Supabase SQL Editor

-- Add family_id column
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS family_id UUID;

-- Add family_name column
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS family_name TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_family_id 
ON inventory_items(family_id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_family_name 
ON inventory_items(family_name);

-- Add comment for documentation
COMMENT ON COLUMN inventory_items.family_id IS 'Links items that belong to the same product family. NULL means item is not part of a family.';
COMMENT ON COLUMN inventory_items.family_name IS 'Base product name shared by all items in the same family (e.g., "Amiibo Figure").';

