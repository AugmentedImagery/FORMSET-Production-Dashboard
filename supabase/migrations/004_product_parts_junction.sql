-- Migration: Many-to-Many relationship for parts and products
-- This allows a single part to be shared across multiple products

-- Create the junction table
CREATE TABLE product_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, part_id)
);

-- Create indexes for efficient queries
CREATE INDEX idx_product_parts_product_id ON product_parts(product_id);
CREATE INDEX idx_product_parts_part_id ON product_parts(part_id);

-- Migrate existing data: copy current part-product relationships to junction table
INSERT INTO product_parts (product_id, part_id)
SELECT product_id, id FROM parts WHERE product_id IS NOT NULL;

-- Drop the old foreign key constraint and index
ALTER TABLE parts DROP CONSTRAINT IF EXISTS parts_product_id_fkey;
DROP INDEX IF EXISTS idx_parts_product_id;

-- Drop the product_id column from parts (data now lives in junction table)
ALTER TABLE parts DROP COLUMN product_id;

-- Enable RLS on the junction table
ALTER TABLE product_parts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_parts (same pattern as parts)
CREATE POLICY "Product parts are viewable by authenticated users"
ON product_parts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Product parts can be created by admin or manager"
ON product_parts FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Product parts can be updated by admin or manager"
ON product_parts FOR UPDATE
TO authenticated
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Product parts can be deleted by admin or manager"
ON product_parts FOR DELETE
TO authenticated
USING (is_admin_or_manager(auth.uid()));
