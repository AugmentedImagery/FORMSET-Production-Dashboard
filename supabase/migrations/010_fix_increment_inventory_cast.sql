-- Fix increment_inventory: the CASE expression added in 009 produces a TEXT
-- value, but inventory_adjustments.adjustment_type is the ENUM type
-- `adjustment_type`. PostgreSQL doesn't auto-cast TEXT to ENUM in all contexts,
-- so the INSERT failed with a type mismatch and PostgREST returned 400 from
-- the rpc/increment_inventory endpoint, breaking manual print logging on the
-- mobile tracker page.
--
-- Fix: explicit ::adjustment_type cast on the CASE result.

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
    (CASE WHEN p_quantity >= 0 THEN 'print_complete' ELSE 'print_failed' END)::adjustment_type,
    'Inventory adjusted by ' || p_quantity
  );

  RETURN new_qty;
END;
$$ LANGUAGE plpgsql;
