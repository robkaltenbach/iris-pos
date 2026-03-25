-- Migration: Add inventory_items table for AI-assisted receiving
-- Run this in your Supabase SQL Editor

-- Step 1: Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'demo-user',
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  short_display_name TEXT,
  brand TEXT,
  category TEXT,
  guessed_size TEXT,
  color TEXT,
  pack_size TEXT,
  human_readable_description TEXT,
  price DECIMAL(10, 2),
  cost DECIMAL(10, 2),
  sku TEXT,
  image_url TEXT,
  embedding vector(512), -- For CLIP embeddings (512 dimensions) or adjust for your embedding model
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create indexes for inventory_items
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_purchase_order_id ON inventory_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_created_at ON inventory_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_items_embedding ON inventory_items USING ivfflat (embedding vector_cosine_ops);

-- Step 4: Enable RLS for inventory_items
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Step 5: Policy: Allow demo user full access to inventory_items
CREATE POLICY "Allow demo user full access to inventory_items"
  ON inventory_items
  FOR ALL
  USING (user_id = 'demo-user')
  WITH CHECK (user_id = 'demo-user');

-- Step 6: Trigger to auto-update updated_at for inventory_items
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

