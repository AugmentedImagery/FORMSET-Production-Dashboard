-- Add UPDATE/DELETE policies for inventory_print_log so the mobile tracker
-- can correct auto-tracked print outcomes (success vs. failed) and flag
-- entries as human-reviewed (source = 'manual').
--
-- Background: 006_inventory_fulfillment.sql granted SELECT and INSERT only.
-- Without UPDATE, Supabase silently rejects updates from the client (no error,
-- zero rows changed), which made marks-as-failed appear to succeed in the UI
-- while the database stayed unchanged.

CREATE POLICY "Admins and managers can update print log"
ON inventory_print_log FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins and managers can delete print log"
ON inventory_print_log FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);
