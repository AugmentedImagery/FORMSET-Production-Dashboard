-- Bambu Lab Cloud API Integration
-- Adds real-time printer state tracking for Bambu Lab printers

-- Add bambu_access_token to printers table (for authentication)
ALTER TABLE printers ADD COLUMN IF NOT EXISTS bambu_access_token TEXT;

-- Create bambu_printer_state table for real-time telemetry
-- This table stores CURRENT state only (one row per printer, upserted on updates)
CREATE TABLE IF NOT EXISTS bambu_printer_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  printer_id UUID NOT NULL UNIQUE REFERENCES printers(id) ON DELETE CASCADE,

  -- Printer Status
  print_stage TEXT,              -- idle, printing, prepare, pause, finish, failed
  gcode_state TEXT,              -- IDLE, RUNNING, PAUSE, FINISH, FAILED

  -- Temperatures (Celsius)
  nozzle_temp DECIMAL(5,2),
  nozzle_target DECIMAL(5,2),
  bed_temp DECIMAL(5,2),
  bed_target DECIMAL(5,2),
  chamber_temp DECIMAL(5,2),

  -- Print Progress
  print_percent INTEGER,         -- 0-100
  current_layer INTEGER,
  total_layers INTEGER,
  time_remaining_min INTEGER,

  -- Current Job Info
  subtask_name TEXT,
  gcode_file TEXT,

  -- AMS Status (JSON for flexibility)
  ams_status JSONB,

  -- Connectivity
  wifi_signal INTEGER,
  online BOOLEAN DEFAULT true,

  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by printer_id
CREATE INDEX IF NOT EXISTS idx_bambu_state_printer ON bambu_printer_state(printer_id);

-- Index for finding offline printers
CREATE INDEX IF NOT EXISTS idx_bambu_state_online ON bambu_printer_state(online);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_bambu_state_updated_at BEFORE UPDATE ON bambu_printer_state
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for bambu_printer_state
ALTER TABLE bambu_printer_state ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read printer state
CREATE POLICY "Users can view printer state"
ON bambu_printer_state FOR SELECT
TO authenticated
USING (true);

-- Only admins and managers can update printer state (or service role)
CREATE POLICY "Admins and managers can update printer state"
ON bambu_printer_state FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins and managers can modify printer state"
ON bambu_printer_state FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- Function to sync printer status from bambu_printer_state
-- This keeps printers.status in sync with the Bambu state
CREATE OR REPLACE FUNCTION sync_printer_status_from_bambu()
RETURNS TRIGGER AS $$
DECLARE
  new_status printer_status;
BEGIN
  -- Map Bambu gcode_state to our printer_status enum
  CASE NEW.gcode_state
    WHEN 'IDLE' THEN new_status := 'idle';
    WHEN 'RUNNING' THEN new_status := 'printing';
    WHEN 'PREPARE' THEN new_status := 'printing';
    WHEN 'PAUSE' THEN new_status := 'maintenance';
    WHEN 'FAILED' THEN new_status := 'error';
    WHEN 'FINISH' THEN new_status := 'idle';
    ELSE new_status := NULL;
  END CASE;

  -- If printer went offline, set to offline status
  IF NEW.online = false THEN
    new_status := 'offline';
  END IF;

  -- Update the printer status if we determined a new status
  IF new_status IS NOT NULL THEN
    UPDATE printers
    SET status = new_status,
        last_heartbeat = NEW.updated_at
    WHERE id = NEW.printer_id;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to keep printer status in sync
CREATE TRIGGER sync_printer_status_on_bambu_update
AFTER INSERT OR UPDATE ON bambu_printer_state
FOR EACH ROW EXECUTE FUNCTION sync_printer_status_from_bambu();
