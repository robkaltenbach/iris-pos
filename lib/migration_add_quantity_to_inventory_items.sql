-- Migration: Add quantity field to inventory_items table
-- Run this in your Supabase SQL Editor

-- Add quantity column to inventory_items (defaults to 1 for existing items)
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

-- Add a check constraint to ensure quantity is at least 1
ALTER TABLE inventory_items
ADD CONSTRAINT check_quantity_positive 
CHECK (quantity >= 1);

