-- Transfer Service Schema
-- Database: transfers_db

CREATE TABLE IF NOT EXISTS transfers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id   UUID NOT NULL,
  to_account_id     UUID NOT NULL,
  amount            NUMERIC(15, 2) NOT NULL
                      CHECK (amount > 0),
  status            VARCHAR(20) NOT NULL DEFAULT 'initiated'
                      CHECK (status IN ('initiated', 'completed', 'failed', 'compensating')),
  saga_state        JSONB NOT NULL DEFAULT '{}',
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by account
CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers (from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to   ON transfers (to_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers (status);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_transfers_updated_at
  BEFORE UPDATE ON transfers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
