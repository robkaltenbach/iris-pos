-- Supabase Database Schema for Iris POS
-- Run these migrations in your Supabase SQL Editor

-- Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'demo-user',
  distributor_name TEXT NOT NULL,
  po_number TEXT NOT NULL,
  date_received TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket Items Table (for sales transactions)
CREATE TABLE IF NOT EXISTS ticket_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'demo-user',
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  verified BOOLEAN DEFAULT FALSE,
  confidence DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id ON purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_items_user_id ON ticket_items(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_items_purchase_order_id ON ticket_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_ticket_items_created_at ON ticket_items(created_at DESC);

-- Enable Row Level Security (RLS) for future multi-user support
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_items ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for demo user (for MVP)
-- This policy allows the demo user to access all data
-- When you add real authentication, you can update these policies to:
--   USING (auth.uid()::text = user_id OR user_id = 'demo-user')
--   WITH CHECK (auth.uid()::text = user_id OR user_id = 'demo-user')
CREATE POLICY "Allow demo user full access to purchase_orders"
  ON purchase_orders
  FOR ALL
  USING (user_id = 'demo-user')
  WITH CHECK (user_id = 'demo-user');

CREATE POLICY "Allow demo user full access to ticket_items"
  ON ticket_items
  FOR ALL
  USING (user_id = 'demo-user')
  WITH CHECK (user_id = 'demo-user');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_items_updated_at
  BEFORE UPDATE ON ticket_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migration: Add status column to existing purchase_orders table
-- Run this if you already have a purchase_orders table without the status column
-- ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'));

-- Inventory Items Table (for receiving/products)
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

-- Create indexes for inventory_items
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_purchase_order_id ON inventory_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_created_at ON inventory_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_items_embedding ON inventory_items USING ivfflat (embedding vector_cosine_ops);

-- Enable RLS for inventory_items
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Policy: Allow demo user full access to inventory_items
CREATE POLICY "Allow demo user full access to inventory_items"
  ON inventory_items
  FOR ALL
  USING (user_id = 'demo-user')
  WITH CHECK (user_id = 'demo-user');

-- Trigger to auto-update updated_at for inventory_items
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable pgvector extension (run this in Supabase SQL editor if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS vector;
