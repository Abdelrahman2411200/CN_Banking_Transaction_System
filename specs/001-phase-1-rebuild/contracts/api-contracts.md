# API Contracts: Phase 1

All responses are wrapped in `ApiResponse<T>`:
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

---

## Account Service — Base URL: `http://localhost:3001`

### GET /health

Returns service liveness. No auth required.

**Response 200**:
```json
{ "success": true, "data": { "status": "ok" } }
```

---

### POST /v1/accounts

Create a new bank account.

**Request body**:
```json
{ "name": "Alice Smith", "email": "alice@example.com", "initial_balance": 1000 }
```
`initial_balance` is optional (defaults to 0).

**Response 201**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Alice Smith",
    "email": "alice@example.com",
    "balance": 1000,
    "kyc_status": "pending",
    "status": "ACTIVE",
    "created_at": "2026-03-17T10:00:00Z",
    "updated_at": "2026-03-17T10:00:00Z"
  }
}
```

**Response 400** — validation failure:
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "email is required" } }
```

**Response 409** — duplicate email:
```json
{ "success": false, "error": { "code": "CONFLICT", "message": "Account with this email already exists" } }
```

---

### GET /v1/accounts/:id

Retrieve an account by UUID.

**Response 200**: Full Account object (same shape as POST 201 data).

**Response 400** — invalid UUID path param:
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid account ID" } }
```

**Response 404**:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Account not found" } }
```

---

### GET /v1/accounts/:id/balance

Returns only the current balance.

**Response 200**:
```json
{ "success": true, "data": { "id": "550e8400-...", "balance": 950 } }
```

**Response 404**: Same as GET /v1/accounts/:id 404.

---

### PATCH /v1/accounts/:id/kyc

Update KYC status.

**Request body**:
```json
{ "kyc_status": "verified" }
```

**Response 200**: Full updated Account object.

**Response 400** — invalid status value:
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "kyc_status must be pending, verified, or rejected" } }
```

**Response 404**: Account not found.

---

### PATCH /v1/accounts/:id/debit *(internal — SAGA use only)*

Deduct `amount` from account balance. Used only by transfer-service SAGA.

**Request body**:
```json
{ "amount": 100 }
```

**Response 200**: Updated Account object.

**Response 422** — insufficient funds:
```json
{ "success": false, "error": { "code": "INSUFFICIENT_FUNDS", "message": "Insufficient balance" } }
```

---

### PATCH /v1/accounts/:id/credit *(internal — SAGA use only)*

Add `amount` to account balance. Used only by transfer-service SAGA.

**Request body**:
```json
{ "amount": 100 }
```

**Response 200**: Updated Account object.

---

## Transfer Service — Base URL: `http://localhost:3002`

### GET /health

Returns service liveness. No auth required.

**Response 200**:
```json
{ "success": true, "data": { "status": "ok" } }
```

---

### POST /v1/transfers

Initiate a money transfer via SAGA orchestration.

**Request body**:
```json
{
  "from_account_id": "550e8400-e29b-41d4-a716-446655440000",
  "to_account_id":   "550e8400-e29b-41d4-a716-446655440001",
  "amount": 250
}
```

**Response 201** — transfer completed:
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "from_account_id": "550e8400-...",
    "to_account_id": "550e8400-...",
    "amount": 250,
    "status": "completed",
    "saga_state": {
      "current_step": "credit",
      "debit_completed": true,
      "credit_completed": true,
      "compensation_completed": false,
      "error": null
    },
    "error_message": null,
    "created_at": "2026-03-17T10:00:00Z",
    "updated_at": "2026-03-17T10:00:01Z"
  }
}
```

**Response 400** — validation failure (self-transfer, invalid UUID, zero amount):
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "from_account_id and to_account_id must be different" } }
```

**Response 422** — insufficient funds (transfer record still created, status=failed):
```json
{ "success": false, "error": { "code": "INSUFFICIENT_FUNDS", "message": "Insufficient balance in source account" } }
```

---

### GET /v1/transfers/:id

Retrieve a transfer by UUID, including SAGA state.

**Response 200**: Full Transfer object (same shape as POST 201 data).

**Response 400** — invalid UUID:
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid transfer ID" } }
```

**Response 404**:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Transfer not found" } }
```

---

## HTTP Status Code Summary

| Code | Meaning                                         |
|------|-------------------------------------------------|
| 200  | Success (GET, PATCH)                            |
| 201  | Created (POST)                                  |
| 400  | Validation error / self-transfer / bad UUID     |
| 404  | Resource not found                              |
| 409  | Conflict (duplicate email)                      |
| 422  | Business rule violation (insufficient funds)    |
| 500  | Unexpected server error                         |
