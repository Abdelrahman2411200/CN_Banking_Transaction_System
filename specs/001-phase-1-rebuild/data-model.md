# Data Model: Phase 1 — Cloud-Native Banking Transaction System

## Entity 1: Account

**Database**: `accounts_db` (postgres-accounts container)
**Table**: `accounts`

| Field        | Type                  | Constraints                                   | Notes                          |
|--------------|-----------------------|-----------------------------------------------|--------------------------------|
| id           | UUID                  | PRIMARY KEY, DEFAULT gen_random_uuid()        | System-generated               |
| name         | VARCHAR(255)          | NOT NULL                                      | Account holder full name       |
| email        | VARCHAR(255)          | NOT NULL, UNIQUE                              | Used for duplicate detection   |
| balance      | NUMERIC(18, 2)        | NOT NULL, DEFAULT 0, CHECK (balance >= 0)     | Fixed-precision, non-negative  |
| kyc_status   | VARCHAR(16)           | NOT NULL, DEFAULT 'pending'                   | pending / verified / rejected  |
| status       | VARCHAR(16)           | NOT NULL, DEFAULT 'ACTIVE'                    | ACTIVE / FROZEN / CLOSED       |
| created_at   | TIMESTAMPTZ           | NOT NULL, DEFAULT now()                       | UTC                            |
| updated_at   | TIMESTAMPTZ           | NOT NULL, DEFAULT now()                       | Updated by trigger             |

**Database Constraints**:
- `UNIQUE (email)` — enforced at DB level; service returns 409 on violation
- `CHECK (balance >= 0)` — enforced at DB level; service returns 422 on violation (pg error 23514)

**State Transitions — KYC Status**:
```
pending → verified
pending → rejected
```
No transitions from `verified` or `rejected` are enforced in Phase 1 (updates are accepted).

**State Transitions — Account Status**:
Phase 1 sets `ACTIVE` on creation. `FROZEN` and `CLOSED` transitions are not implemented in Phase 1 but the field is present for Phase 2+ use.

---

## Entity 2: Transfer

**Database**: `transfers_db` (postgres-transfers container)
**Table**: `transfers`

| Field             | Type           | Constraints                                              | Notes                               |
|-------------------|----------------|----------------------------------------------------------|-------------------------------------|
| id                | UUID           | PRIMARY KEY, DEFAULT gen_random_uuid()                   | System-generated                    |
| from_account_id   | UUID           | NOT NULL                                                 | Source account (no FK in Phase 1)   |
| to_account_id     | UUID           | NOT NULL                                                 | Destination account (no FK)         |
| amount            | NUMERIC(18, 2) | NOT NULL, CHECK (amount > 0)                             | Transfer amount, positive           |
| status            | VARCHAR(24)    | NOT NULL, DEFAULT 'initiated'                            | See state machine below             |
| saga_state        | JSONB          | NOT NULL, DEFAULT '{}'                                   | Full SAGA step history              |
| error_message     | TEXT           |                                                          | Top-level error, nullable           |
| created_at        | TIMESTAMPTZ    | NOT NULL, DEFAULT now()                                  | UTC                                 |
| updated_at        | TIMESTAMPTZ    | NOT NULL, DEFAULT now()                                  | Updated by trigger                  |

**Database Constraints**:
- `CHECK (amount > 0)` — enforced at DB level
- `CHECK (from_account_id <> to_account_id)` — enforced at DB level; service also validates at input layer (returns 400)

**State Transitions — Transfer Status**:
```
initiated
  ↓ (debit succeeds)
debited
  ↓ (credit succeeds)        ↓ (credit fails)
completed                   failed
                              ↑ (compensation completes or fails)
```

| Transition       | Trigger                                   |
|------------------|-------------------------------------------|
| → initiated      | Transfer record created                   |
| → debited        | Source account debited successfully       |
| → completed      | Destination account credited successfully |
| → failed         | Debit failed OR credit failed (after compensation attempted) |

---

## Entity 3: SagaState (embedded JSONB within Transfer)

**Not a separate table** — stored as JSONB in `transfers.saga_state`.

| Field                    | Type    | Description                                                          |
|--------------------------|---------|----------------------------------------------------------------------|
| current_step             | string  | Name of the last step attempted: `debit`, `credit`, `compensate`     |
| debit_completed          | boolean | Whether the debit step succeeded                                     |
| credit_completed         | boolean | Whether the credit step succeeded                                    |
| compensation_completed   | boolean | Whether the compensation step completed (true even if it also failed)|
| error                    | string  | Error message captured at the point of failure (nullable)            |

**Example — happy path**:
```json
{
  "current_step": "credit",
  "debit_completed": true,
  "credit_completed": true,
  "compensation_completed": false,
  "error": null
}
```

**Example — compensation triggered**:
```json
{
  "current_step": "compensate",
  "debit_completed": true,
  "credit_completed": false,
  "compensation_completed": true,
  "error": "Credit failed: account not found. Compensation succeeded."
}
```

**Example — compensation also failed**:
```json
{
  "current_step": "compensate",
  "debit_completed": true,
  "credit_completed": false,
  "compensation_completed": false,
  "error": "Credit failed: insufficient target. Compensation failed: service unavailable."
}
```

---

## Shared TypeScript Interfaces (`shared/types/src/index.ts`)

The following interfaces must be defined in the shared package and imported by both services:

```typescript
// Wrap all API responses
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

// Account entity
interface Account {
  id: string;
  name: string;
  email: string;
  balance: number;
  kyc_status: KycStatus;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

// Transfer entity
interface Transfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  status: TransferStatus;
  saga_state: SagaState;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// SAGA state machine snapshot
interface SagaState {
  current_step: string;
  debit_completed: boolean;
  credit_completed: boolean;
  compensation_completed: boolean;
  error: string | null;
}

// DTOs
interface CreateAccountDto {
  name: string;
  email: string;
  initial_balance?: number;
}

interface UpdateKycDto {
  kyc_status: KycStatus;
}

interface CreateTransferDto {
  from_account_id: string;
  to_account_id: string;
  amount: number;
}

// Enums
type KycStatus = 'pending' | 'verified' | 'rejected';
type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
type TransferStatus = 'initiated' | 'debited' | 'completed' | 'failed';
```

---

## Validation Rules

### Account — Create (POST /v1/accounts)
- `name`: required, non-empty string
- `email`: required, valid email format
- `initial_balance`: optional, number >= 0, defaults to 0 if omitted

### Account — KYC Update (PATCH /v1/accounts/:id/kyc)
- `kyc_status`: required, must be one of `pending` / `verified` / `rejected`

### Transfer — Create (POST /v1/transfers)
- `from_account_id`: required, valid UUID
- `to_account_id`: required, valid UUID, must not equal `from_account_id`
- `amount`: required, number > 0

### Path Parameters
- All `:id` parameters: validated as UUID format; non-UUID returns 400
