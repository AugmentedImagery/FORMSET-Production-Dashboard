-- Add quantity column to print_history to track multiple prints per log action
-- Version: 1.0.1

-- Add quantity column (defaults to 1 for backwards compatibility)
ALTER TABLE print_history ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

-- Update any existing records to have quantity 1 (already default, but explicit)
UPDATE print_history SET quantity = 1 WHERE quantity IS NULL;
