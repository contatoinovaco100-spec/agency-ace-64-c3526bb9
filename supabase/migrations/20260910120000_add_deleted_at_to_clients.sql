-- Add soft-delete column to clients table (mirrors tasks pattern)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON clients (deleted_at) WHERE deleted_at IS NULL;
