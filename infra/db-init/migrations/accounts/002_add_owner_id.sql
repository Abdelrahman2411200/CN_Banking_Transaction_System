ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS owner_id UUID;

CREATE INDEX IF NOT EXISTS idx_accounts_owner_id ON accounts (owner_id);
