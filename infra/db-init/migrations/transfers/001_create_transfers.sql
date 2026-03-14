CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY,
  from_account_id UUID NOT NULL,
  to_account_id UUID NOT NULL,
  amount NUMERIC(18, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(24) NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_transfer_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_accounts_distinct CHECK (from_account_id <> to_account_id)
);
