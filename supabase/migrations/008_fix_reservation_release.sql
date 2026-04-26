-- Adds the missing release_inventory_reservation RPC and repairs the current
-- inventory.quantity_reserved values, which have drifted because the order
-- cancellation flow has been silently failing to release reservations:
--
--   1. The previous client-side cancel code calls supabase.rpc('release_inventory_reservation', ...)
--      but that function was never created in any prior migration.
--   2. Supabase JS resolves missing-RPC calls with { error: ... } rather than
--      rejecting, so the .catch() fallback never ran. The error was swallowed.
--   3. Allocations for cancelled orders were deleted by the same cancel flow,
--      so the source of truth for "what's currently reserved" is the remaining
--      rows in order_part_allocations (only active orders).
--
-- This migration:
--   - Creates release_inventory_reservation so future cancels work correctly.
--   - One-shot rebuilds inventory.quantity_reserved from the current allocations
--     of non-completed, non-cancelled orders. This unsticks parts whose reserved
--     counts are inflated from prior buggy cancellations.

-- 1. Create the missing RPC --------------------------------------------------

CREATE OR REPLACE FUNCTION release_inventory_reservation(
  p_part_id UUID,
  p_quantity INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  new_reserved INTEGER;
BEGIN
  UPDATE inventory
  SET quantity_reserved = GREATEST(0, quantity_reserved - p_quantity),
      last_updated = NOW()
  WHERE part_id = p_part_id
  RETURNING quantity_reserved INTO new_reserved;

  RETURN COALESCE(new_reserved, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION release_inventory_reservation(UUID, INTEGER) TO authenticated;

-- 2. One-time repair: recompute quantity_reserved from live allocations -------

UPDATE inventory i
SET quantity_reserved = COALESCE(sub.total_allocated, 0),
    last_updated = NOW()
FROM (
  SELECT
    p.id AS part_id,
    SUM(opa.quantity_allocated) AS total_allocated
  FROM parts p
  LEFT JOIN order_part_allocations opa ON opa.part_id = p.id
  LEFT JOIN production_orders po ON po.id = opa.production_order_id
    AND po.status NOT IN ('completed', 'cancelled')
  GROUP BY p.id
) sub
WHERE i.part_id = sub.part_id
  AND i.quantity_reserved IS DISTINCT FROM COALESCE(sub.total_allocated, 0);
