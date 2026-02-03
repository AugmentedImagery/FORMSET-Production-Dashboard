-- Inventory-Based Order Fulfillment System
-- Decouples prints from orders, uses inventory pool with FIFO allocation

-- ============================================================================
-- 1. NEW TABLES
-- ============================================================================

-- Maps Bambu gcode filenames to parts for automatic inventory tracking
CREATE TABLE IF NOT EXISTS gcode_part_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gcode_filename TEXT NOT NULL,
  part_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gcode_filename)
);

CREATE INDEX idx_gcode_mappings_filename ON gcode_part_mappings(gcode_filename);
CREATE INDEX idx_gcode_mappings_part ON gcode_part_mappings(part_id);
CREATE INDEX idx_gcode_mappings_active ON gcode_part_mappings(is_active) WHERE is_active = true;

-- Tracks part allocations for orders (replaces tight coupling to print_jobs)
CREATE TABLE IF NOT EXISTS order_part_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
  quantity_needed INTEGER NOT NULL,       -- Total parts needed for this order
  quantity_allocated INTEGER DEFAULT 0,   -- Parts reserved from inventory
  status TEXT DEFAULT 'pending',          -- pending, partially_allocated, allocated
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(production_order_id, part_id)
);

CREATE INDEX idx_allocations_order ON order_part_allocations(production_order_id);
CREATE INDEX idx_allocations_part ON order_part_allocations(part_id);
CREATE INDEX idx_allocations_status ON order_part_allocations(status);

-- Standalone print log (not tied to specific orders)
CREATE TABLE IF NOT EXISTS inventory_print_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id UUID NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  gcode_filename TEXT,
  quantity_printed INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  source TEXT NOT NULL CHECK (source IN ('bambu_auto', 'manual')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  failure_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_print_log_part ON inventory_print_log(part_id);
CREATE INDEX idx_print_log_printer ON inventory_print_log(printer_id);
CREATE INDEX idx_print_log_completed ON inventory_print_log(completed_at DESC);
CREATE INDEX idx_print_log_status ON inventory_print_log(status);

-- ============================================================================
-- 2. MODIFY EXISTING TABLES
-- ============================================================================

-- Add fulfillment tracking to production_orders
ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'unfulfilled',
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;

-- Add constraint for fulfillment_status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'production_orders_fulfillment_status_check'
  ) THEN
    ALTER TABLE production_orders
      ADD CONSTRAINT production_orders_fulfillment_status_check
      CHECK (fulfillment_status IN ('unfulfilled', 'partially_fulfilled', 'fulfilled'));
  END IF;
END $$;

-- ============================================================================
-- 3. AUTO-UPDATE TRIGGERS
-- ============================================================================

CREATE TRIGGER update_gcode_mappings_updated_at
  BEFORE UPDATE ON gcode_part_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_allocations_updated_at
  BEFORE UPDATE ON order_part_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. CORE FUNCTIONS
-- ============================================================================

-- Function to allocate inventory to a specific order
CREATE OR REPLACE FUNCTION allocate_inventory_for_order(p_order_id UUID)
RETURNS INTEGER AS $$
DECLARE
  allocation RECORD;
  available_qty INTEGER;
  qty_to_allocate INTEGER;
  total_allocated INTEGER := 0;
BEGIN
  -- Loop through all allocations for this order that need more parts
  FOR allocation IN
    SELECT opa.*
    FROM order_part_allocations opa
    WHERE opa.production_order_id = p_order_id
      AND opa.quantity_allocated < opa.quantity_needed
  LOOP
    -- Get available inventory for this part
    SELECT GREATEST(0, quantity_on_hand - quantity_reserved) INTO available_qty
    FROM inventory WHERE part_id = allocation.part_id;

    IF available_qty > 0 THEN
      -- Calculate how much to allocate
      qty_to_allocate := LEAST(
        available_qty,
        allocation.quantity_needed - allocation.quantity_allocated
      );

      -- Update allocation
      UPDATE order_part_allocations
      SET quantity_allocated = quantity_allocated + qty_to_allocate,
          status = CASE
            WHEN quantity_allocated + qty_to_allocate >= quantity_needed THEN 'allocated'
            ELSE 'partially_allocated'
          END
      WHERE id = allocation.id;

      -- Reserve in inventory
      UPDATE inventory
      SET quantity_reserved = quantity_reserved + qty_to_allocate,
          last_updated = NOW()
      WHERE part_id = allocation.part_id;

      -- Log the reservation
      INSERT INTO inventory_adjustments
        (part_id, previous_quantity, new_quantity, adjustment_type, reason)
      SELECT part_id,
             quantity_reserved - qty_to_allocate,
             quantity_reserved,
             'order_reserved',
             'Reserved for order ' || p_order_id::TEXT
      FROM inventory WHERE part_id = allocation.part_id;

      total_allocated := total_allocated + qty_to_allocate;
    END IF;
  END LOOP;

  -- Check if order is fully allocated
  PERFORM check_order_fulfillment(p_order_id);

  RETURN total_allocated;
END;
$$ LANGUAGE plpgsql;

-- Function to allocate inventory to all waiting orders for a specific part (FIFO)
CREATE OR REPLACE FUNCTION allocate_inventory_to_orders(p_part_id UUID)
RETURNS INTEGER AS $$
DECLARE
  available_qty INTEGER;
  allocation RECORD;
  qty_to_allocate INTEGER;
  total_allocated INTEGER := 0;
BEGIN
  -- Get available inventory (on_hand minus already reserved)
  SELECT GREATEST(0, quantity_on_hand - quantity_reserved) INTO available_qty
  FROM inventory WHERE part_id = p_part_id;

  IF available_qty <= 0 THEN
    RETURN 0;
  END IF;

  -- Loop through unfulfilled allocations in priority/FIFO order
  FOR allocation IN
    SELECT opa.*, po.priority, po.created_at as order_created
    FROM order_part_allocations opa
    JOIN production_orders po ON opa.production_order_id = po.id
    WHERE opa.part_id = p_part_id
      AND opa.quantity_allocated < opa.quantity_needed
      AND po.status NOT IN ('completed', 'cancelled')
    ORDER BY
      CASE po.priority
        WHEN 'critical' THEN 0
        WHEN 'rush' THEN 1
        ELSE 2
      END,
      po.created_at ASC
  LOOP
    EXIT WHEN available_qty <= 0;

    -- Calculate how much to allocate
    qty_to_allocate := LEAST(
      available_qty,
      allocation.quantity_needed - allocation.quantity_allocated
    );

    -- Update allocation
    UPDATE order_part_allocations
    SET quantity_allocated = quantity_allocated + qty_to_allocate,
        status = CASE
          WHEN quantity_allocated + qty_to_allocate >= quantity_needed THEN 'allocated'
          ELSE 'partially_allocated'
        END
    WHERE id = allocation.id;

    -- Reserve in inventory
    UPDATE inventory
    SET quantity_reserved = quantity_reserved + qty_to_allocate,
        last_updated = NOW()
    WHERE part_id = p_part_id;

    -- Log the reservation
    INSERT INTO inventory_adjustments
      (part_id, previous_quantity, new_quantity, adjustment_type, reason)
    SELECT part_id,
           quantity_reserved - qty_to_allocate,
           quantity_reserved,
           'order_reserved',
           'Reserved for order ' || allocation.production_order_id::TEXT
    FROM inventory WHERE part_id = p_part_id;

    available_qty := available_qty - qty_to_allocate;
    total_allocated := total_allocated + qty_to_allocate;

    -- Check if this order is now fully allocated
    PERFORM check_order_fulfillment(allocation.production_order_id);
  END LOOP;

  RETURN total_allocated;
END;
$$ LANGUAGE plpgsql;

-- Function to check and update order fulfillment status
CREATE OR REPLACE FUNCTION check_order_fulfillment(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  all_allocated BOOLEAN;
  any_allocated BOOLEAN;
BEGIN
  -- Check if all allocations for this order are fully allocated
  SELECT
    NOT EXISTS (
      SELECT 1 FROM order_part_allocations
      WHERE production_order_id = p_order_id
        AND quantity_allocated < quantity_needed
    ),
    EXISTS (
      SELECT 1 FROM order_part_allocations
      WHERE production_order_id = p_order_id
        AND quantity_allocated > 0
    )
  INTO all_allocated, any_allocated;

  IF all_allocated THEN
    -- Order is fully fulfilled
    UPDATE production_orders
    SET fulfillment_status = 'fulfilled',
        fulfilled_at = NOW(),
        status = 'completed',
        completed_at = NOW()
    WHERE id = p_order_id
      AND status NOT IN ('completed', 'cancelled');

    RETURN TRUE;
  ELSIF any_allocated THEN
    -- Order is partially fulfilled
    UPDATE production_orders
    SET fulfillment_status = 'partially_fulfilled'
    WHERE id = p_order_id
      AND status NOT IN ('completed', 'cancelled')
      AND fulfillment_status != 'partially_fulfilled';
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to increment inventory (called from Python service)
CREATE OR REPLACE FUNCTION increment_inventory(p_part_id UUID, p_quantity INTEGER)
RETURNS INTEGER AS $$
DECLARE
  old_qty INTEGER;
  new_qty INTEGER;
BEGIN
  -- Get current quantity
  SELECT quantity_on_hand INTO old_qty
  FROM inventory WHERE part_id = p_part_id;

  -- Update inventory
  UPDATE inventory
  SET quantity_on_hand = quantity_on_hand + p_quantity,
      last_updated = NOW()
  WHERE part_id = p_part_id
  RETURNING quantity_on_hand INTO new_qty;

  -- Log the adjustment
  INSERT INTO inventory_adjustments
    (part_id, previous_quantity, new_quantity, adjustment_type, reason)
  VALUES (p_part_id, old_qty, new_qty, 'print_complete', 'Print completed - added ' || p_quantity || ' parts');

  RETURN new_qty;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. TRIGGER TO AUTO-ALLOCATE WHEN INVENTORY INCREASES
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_allocate_on_inventory_increase()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when quantity_on_hand increases
  IF NEW.quantity_on_hand > OLD.quantity_on_hand THEN
    PERFORM allocate_inventory_to_orders(NEW.part_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists, then create new one
DROP TRIGGER IF EXISTS allocate_inventory_after_increase ON inventory;

CREATE TRIGGER allocate_inventory_after_increase
AFTER UPDATE ON inventory
FOR EACH ROW
WHEN (NEW.quantity_on_hand > OLD.quantity_on_hand)
EXECUTE FUNCTION trigger_allocate_on_inventory_increase();

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE gcode_part_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_part_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_print_log ENABLE ROW LEVEL SECURITY;

-- gcode_part_mappings policies
CREATE POLICY "Users can view gcode mappings"
ON gcode_part_mappings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and managers can manage gcode mappings"
ON gcode_part_mappings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- order_part_allocations policies
CREATE POLICY "Users can view allocations"
ON order_part_allocations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and managers can manage allocations"
ON order_part_allocations FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- inventory_print_log policies
CREATE POLICY "Users can view print log"
ON inventory_print_log FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and managers can insert print log"
ON inventory_print_log FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- ============================================================================
-- 7. HELPER VIEWS
-- ============================================================================

-- View for part demand calculation (what needs to be printed)
CREATE OR REPLACE VIEW part_demand AS
SELECT
  p.id as part_id,
  p.name as part_name,
  p.parts_per_print,
  p.print_time_minutes,
  COALESCE(SUM(opa.quantity_needed - opa.quantity_allocated), 0) as total_demand,
  COALESCE(i.quantity_on_hand - i.quantity_reserved, 0) as available_inventory,
  GREATEST(0,
    COALESCE(SUM(opa.quantity_needed - opa.quantity_allocated), 0) -
    COALESCE(i.quantity_on_hand - i.quantity_reserved, 0)
  ) as deficit,
  CEIL(
    GREATEST(0,
      COALESCE(SUM(opa.quantity_needed - opa.quantity_allocated), 0) -
      COALESCE(i.quantity_on_hand - i.quantity_reserved, 0)
    )::DECIMAL / NULLIF(p.parts_per_print, 0)
  ) as prints_required
FROM parts p
LEFT JOIN inventory i ON p.id = i.part_id
LEFT JOIN order_part_allocations opa ON p.id = opa.part_id
  AND opa.status != 'allocated'
LEFT JOIN production_orders po ON opa.production_order_id = po.id
  AND po.status NOT IN ('completed', 'cancelled')
GROUP BY p.id, p.name, p.parts_per_print, p.print_time_minutes, i.quantity_on_hand, i.quantity_reserved;
