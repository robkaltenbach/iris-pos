-- Migration: Add verified and confidence fields to inventory_items
-- Run this in your Supabase SQL Editor

-- Add verified field (per-item-per-PO verification)
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Add confidence field (AI confidence score for the item detection)
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS confidence DECIMAL(5, 2);

-- Create index for verified field to improve query performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_verified ON inventory_items(verified) WHERE verified = FALSE;

-- Create index for confidence field
CREATE INDEX IF NOT EXISTS idx_inventory_items_confidence ON inventory_items(confidence);

