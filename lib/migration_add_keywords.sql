-- Migration: Add keywords column to inventory_items table
-- This stores searchable keywords extracted by AI to help match products
-- even when the exact name differs

ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS keywords TEXT[];

-- Add comment to explain the field
COMMENT ON COLUMN inventory_items.keywords IS 'Array of searchable keywords extracted by AI to help match products with different names';

