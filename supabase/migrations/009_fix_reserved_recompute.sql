-- Repair migration: 008's recompute had a broken filter, and increment_inventory
-- could drive quantity_on_hand negative. This migration fixes both.
--
-- Bug 1 — broken filter in 008:
--   The previous recompute used:
--     LEFT JOIN production_orders po ON po.id = opa.production_order_id
--       AND po.status NOT IN ('completed', 'cancelled')
--   With LEFT JOIN, when the ON condition fails, po.* is set to NULL but the
--   opa row is still preserved (that is what LEFT JOIN does). The SUM kept
--   adding quantity_allocated for completed/cancelled orders. The fix is a
--   correlated subquery that only sees active allocations, so completed and
--   cancelled allocations are genuinely excluded.
--
-- Bug 2 — negative on_hand:
--   increment_inventory was UPDATE inventory SET quantity_on_hand = ... + p_quantity
--   with no clamp. When the tracker marks a historic print as failed against a
--   part whose on-hand has already been zeroed (e.g. during a recount), it
--   subtracts and the value goes below zero. We clamp to GREATEST(0, ...) and
--   one-shot fix any rows already negative.

-- 1. Clamp increment_inventory so it never drives on_hand below zero ----------

CREATE OR REPLACE FUNCTION increment_inventory(p_part_id UUID, p_quantity INTEGER)
RETURNS INTEGER AS $$
DECLARE
  old_qty INTEGER;
  new_qty INTEGER;
BEGIN
  SELECT quantity_on_hand INTO old_qty
  FROM inventory WHERE part_id = p_part_id;

  UPDATE inventory
  SET quantity_on_hand = GREATEST(0, quantity_on_hand + p_quantity),
      last_updated = NOW()
  WHERE part_id = p_part_id
  RETURNING quantity_on_hand INTO new_qty;

  INSERT INTO inventory_adjustments
    (part_id, previous_quantity, new_quantity, adjustment_type, reason)
  VALUES (
    p_part_id,
    old_qty,
    new_qty,
    CASE WHEN p_quantity >= 0 THEN 'print_complete' ELSE 'print_failed' END,
    'Inventory adjusted by ' || p_quantity
  );

  RETURN new_qty;
END;
$$ LANGUAGE plpgsql;

-- 2. One-shot: clamp any already-negative on_hand to zero --------------------

UPDATE inventory
SET quantity_on_hand = 0,
    last_updated = NOW()
WHERE quantity_on_hand < 0;

-- 3. Recompute quantity_reserved correctly -----------------------------------
-- Correlated subquery — for each inventory row, sum allocations only from
-- orders whose status is currently active.

UPDATE inventory i
SET quantity_reserved = COALESCE((
  SELECT SUM(opa.quantity_allocated)
  FROM order_part_allocations opa
  JOIN production_orders po ON po.id = opa.production_order_id
  WHERE opa.part_id = i.part_id
    AND po.status NOT IN ('completed', 'cancelled')
), 0),
    last_updated = NOW();
