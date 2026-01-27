-- Production Dashboard Database Schema
-- Version: 1.0.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE product_type AS ENUM ('kiosk', 'planter');
CREATE TYPE order_source AS ENUM ('internal', 'shopify');
CREATE TYPE order_priority AS ENUM ('normal', 'rush', 'critical');
CREATE TYPE order_status AS ENUM ('pending', 'in_production', 'completed', 'cancelled');
CREATE TYPE print_job_status AS ENUM ('queued', 'printing', 'completed', 'failed');
CREATE TYPE printer_status AS ENUM ('idle', 'printing', 'error', 'offline', 'maintenance');
CREATE TYPE print_history_status AS ENUM ('success', 'failed', 'cancelled');
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'viewer');
CREATE TYPE adjustment_type AS ENUM ('manual', 'print_complete', 'print_failed', 'order_reserved', 'order_released');

-- Products table (Kiosk, Planter)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  type product_type NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parts table (8 total: 5 kiosk + 3 planter)
CREATE TABLE parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  print_time_minutes INTEGER NOT NULL DEFAULT 60,
  material_grams DECIMAL(10, 2) NOT NULL DEFAULT 0,
  parts_per_print INTEGER NOT NULL DEFAULT 1,
  color TEXT,
  material_type TEXT NOT NULL DEFAULT 'PLA',
  gcode_file_url TEXT,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory table (current stock levels)
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id UUID NOT NULL UNIQUE REFERENCES parts(id) ON DELETE CASCADE,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Printers table (for Bambu Labs integration)
CREATE TABLE printers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  model TEXT,
  serial_number TEXT,
  status printer_status NOT NULL DEFAULT 'offline',
  current_job_id UUID,
  bambu_device_id TEXT,
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Production Orders table (internal + Shopify)
CREATE TABLE production_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source order_source NOT NULL DEFAULT 'internal',
  shopify_order_id TEXT,
  shopify_order_number TEXT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  priority order_priority NOT NULL DEFAULT 'normal',
  status order_status NOT NULL DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Print Jobs table (individual print tasks)
CREATE TABLE print_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
  quantity_needed INTEGER NOT NULL DEFAULT 1,
  quantity_completed INTEGER NOT NULL DEFAULT 0,
  quantity_failed INTEGER NOT NULL DEFAULT 0,
  status print_job_status NOT NULL DEFAULT 'queued',
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  scheduled_start TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for printers.current_job_id after print_jobs exists
ALTER TABLE printers
ADD CONSTRAINT fk_printers_current_job
FOREIGN KEY (current_job_id) REFERENCES print_jobs(id) ON DELETE SET NULL;

-- Print History table (for analytics)
CREATE TABLE print_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  print_job_id UUID NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  part_id UUID NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
  status print_history_status NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  failure_reason TEXT,
  material_used_grams DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Profiles table (extends auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'viewer',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Adjustments table (audit log)
CREATE TABLE inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  adjustment_type adjustment_type NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shopify Product Mapping table
CREATE TABLE shopify_product_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_product_id TEXT NOT NULL UNIQUE,
  shopify_variant_id TEXT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_parts_product_id ON parts(product_id);
CREATE INDEX idx_inventory_part_id ON inventory(part_id);
CREATE INDEX idx_production_orders_status ON production_orders(status);
CREATE INDEX idx_production_orders_product_id ON production_orders(product_id);
CREATE INDEX idx_production_orders_due_date ON production_orders(due_date);
CREATE INDEX idx_print_jobs_order_id ON print_jobs(production_order_id);
CREATE INDEX idx_print_jobs_part_id ON print_jobs(part_id);
CREATE INDEX idx_print_jobs_status ON print_jobs(status);
CREATE INDEX idx_print_history_job_id ON print_history(print_job_id);
CREATE INDEX idx_print_history_part_id ON print_history(part_id);
CREATE INDEX idx_inventory_adjustments_part_id ON inventory_adjustments(part_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parts_updated_at BEFORE UPDATE ON parts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_printers_updated_at BEFORE UPDATE ON printers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_print_jobs_updated_at BEFORE UPDATE ON print_jobs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to auto-create inventory record when a part is created
CREATE OR REPLACE FUNCTION create_inventory_for_part()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inventory (part_id, quantity_on_hand, quantity_reserved)
  VALUES (NEW.id, 0, 0);
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_inventory_after_part_insert AFTER INSERT ON parts
FOR EACH ROW EXECUTE FUNCTION create_inventory_for_part();

-- Create function to auto-create user profile when auth user is created
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'viewer');
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_profile_after_user_signup AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Create function to update inventory when print job is updated
CREATE OR REPLACE FUNCTION update_inventory_on_print_complete()
RETURNS TRIGGER AS $$
DECLARE
  parts_produced INTEGER;
  parts_per_print INTEGER;
BEGIN
  -- Only process if quantity_completed changed
  IF OLD.quantity_completed IS DISTINCT FROM NEW.quantity_completed THEN
    -- Get parts_per_print from the part
    SELECT p.parts_per_print INTO parts_per_print FROM parts p WHERE p.id = NEW.part_id;

    -- Calculate how many additional parts were produced
    parts_produced := (NEW.quantity_completed - OLD.quantity_completed) * parts_per_print;

    -- Update inventory
    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand + parts_produced,
        last_updated = NOW()
    WHERE part_id = NEW.part_id;

    -- Log the adjustment
    INSERT INTO inventory_adjustments (part_id, previous_quantity, new_quantity, adjustment_type, reason)
    SELECT
      NEW.part_id,
      i.quantity_on_hand - parts_produced,
      i.quantity_on_hand,
      'print_complete',
      'Print job ' || NEW.id || ' completed ' || parts_produced || ' parts'
    FROM inventory i WHERE i.part_id = NEW.part_id;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_on_job_update AFTER UPDATE ON print_jobs
FOR EACH ROW EXECUTE FUNCTION update_inventory_on_print_complete();

-- Insert seed data for products
INSERT INTO products (name, sku, type, description) VALUES
('Kiosk Display Unit', 'KIOSK-001', 'kiosk', 'Complete kiosk assembly with 5 printed parts'),
('Self-Watering Planter', 'PLANTER-001', 'planter', 'Self-watering planter system with 3 printed parts');

-- Insert seed data for parts (will auto-create inventory via trigger)
-- Kiosk parts (5 total)
INSERT INTO parts (product_id, name, print_time_minutes, material_grams, parts_per_print, color, material_type, low_stock_threshold) VALUES
((SELECT id FROM products WHERE sku = 'KIOSK-001'), 'iPad Holder', 180, 120, 2, 'White', 'PLA', 10),
((SELECT id FROM products WHERE sku = 'KIOSK-001'), 'Base Plate', 240, 200, 1, 'White', 'PLA', 5),
((SELECT id FROM products WHERE sku = 'KIOSK-001'), 'Cable Management Cover', 45, 30, 4, 'White', 'PLA', 15),
((SELECT id FROM products WHERE sku = 'KIOSK-001'), 'Stand Column', 300, 350, 1, 'White', 'PLA', 5),
((SELECT id FROM products WHERE sku = 'KIOSK-001'), 'Logo Badge', 20, 15, 8, 'Black', 'PLA', 20);

-- Planter parts (3 total)
INSERT INTO parts (product_id, name, print_time_minutes, material_grams, parts_per_print, color, material_type, low_stock_threshold) VALUES
((SELECT id FROM products WHERE sku = 'PLANTER-001'), 'Reservoir Base', 120, 80, 2, 'Terracotta', 'PETG', 10),
((SELECT id FROM products WHERE sku = 'PLANTER-001'), 'Inner Pot', 90, 60, 2, 'Terracotta', 'PETG', 10),
((SELECT id FROM products WHERE sku = 'PLANTER-001'), 'Water Level Indicator', 15, 8, 6, 'White', 'PLA', 25);
