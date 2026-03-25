-- Create a table to store global PO counter
-- This persists across data wipes and ensures PO numbers are always unique
CREATE TABLE IF NOT EXISTS po_counter (
  id TEXT PRIMARY KEY DEFAULT 'global',
  counter INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial counter if it doesn't exist
INSERT INTO po_counter (id, counter) 
VALUES ('global', 1)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE po_counter ENABLE ROW LEVEL SECURITY;

-- Policy: Allow demo user full access
CREATE POLICY "Allow demo user full access to po_counter"
  ON po_counter
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function for atomic counter increment
CREATE OR REPLACE FUNCTION increment_po_counter()
RETURNS INTEGER AS $$
DECLARE
  new_counter INTEGER;
BEGIN
  UPDATE po_counter
  SET counter = counter + 1,
      updated_at = NOW()
  WHERE id = 'global'
  RETURNING counter INTO new_counter;
  
  -- If no row exists, create it
  IF new_counter IS NULL THEN
    INSERT INTO po_counter (id, counter, updated_at)
    VALUES ('global', 1, NOW())
    RETURNING counter INTO new_counter;
  END IF;
  
  RETURN new_counter;
END;
$$ LANGUAGE plpgsql;

