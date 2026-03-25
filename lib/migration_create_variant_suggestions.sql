-- Migration: Create variant_suggestions table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS variant_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'demo-user',
  base_name_suggestion TEXT NOT NULL,
  item_ids UUID[] NOT NULL, -- Array of inventory_item IDs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days', -- Auto-cleanup old suggestions
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed'))
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_variant_suggestions_user_id 
ON variant_suggestions(user_id);

CREATE INDEX IF NOT EXISTS idx_variant_suggestions_status 
ON variant_suggestions(status);

CREATE INDEX IF NOT EXISTS idx_variant_suggestions_expires_at 
ON variant_suggestions(expires_at);

-- Enable RLS for variant_suggestions
ALTER TABLE variant_suggestions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow demo user full access to variant_suggestions
CREATE POLICY "Allow demo user full access to variant_suggestions"
  ON variant_suggestions
  FOR ALL
  USING (user_id = 'demo-user')
  WITH CHECK (user_id = 'demo-user');

-- Add comment for documentation
COMMENT ON TABLE variant_suggestions IS 'Stores pending variant grouping suggestions. Auto-expires after 7 days.';
COMMENT ON COLUMN variant_suggestions.base_name_suggestion IS 'Suggested base product name (e.g., "Amiibo Figure")';
COMMENT ON COLUMN variant_suggestions.item_ids IS 'Array of inventory_item IDs that should be grouped together';
COMMENT ON COLUMN variant_suggestions.status IS 'pending: waiting for user action, confirmed: user accepted, dismissed: user rejected';

