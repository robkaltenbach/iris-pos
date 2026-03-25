-- Migration: Add ai_detected_name column to inventory_items table
-- This stores the original AI-detected name so we can match future scans
-- even if the user renamed the item

ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS ai_detected_name TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN inventory_items.ai_detected_name IS 'Original name detected by AI, used for matching future scans even if user renamed the item';

