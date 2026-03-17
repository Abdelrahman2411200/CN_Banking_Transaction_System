# API Contract
# Cloud-Native Banking Transaction System

## 1. API Standards

- protocol: HTTPS
- format: JSON
- versioning: `/api/v1`
- auth: Bearer JWT
- idempotency: required for transfer creation
- correlation: `X-Correlation-Id` header supported
- content type: `application/json`

Base path examples:
- `/api/v1/accounts`
- `/api/v1/transfers`
- `/api/v1/fraud-alerts`
- `/api/v1/ledger`

---

## 2. Common Headers

### Request Headers
```http
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
X-Correlation-Id: <uuid>
Idempotency-Key: <unique-string>   // required for POST /transfers
```

### Response Headers
```http
X-Correlation-Id: <uuid>
Content-Type: application/json
```

---

## 3. Error Model

All services should return a common error structure.

```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "The sender account does not have sufficient balance.",
    "details": {
      "account_id": "uuid",
      "available_balance": 100.00,
      "attempted_amount": 150.00
    }
  },
  "correlation_id": "uuid",
  "timestamp": "2026-03-17T12:00:00Z"
}
```

### Standard Error Codes
- `UNAUTHORIZED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `ACCOUNT_NOT_FOUND`
- `ACCOUNT_FROZEN`
- `INSUFFICIENT_FUNDS`
- `DUPLICATE_REQUEST`
- `IDEMPOTENCY_CONFLICT`
- `TRANSFER_NOT_FOUND`
- `INTERNAL_ERROR`
- `SERVICE_UNAVAILABLE`

---

## 4. Authentication / Authorization

### Roles
- `admin`
- `operations`
- `auditor`
- `service`

### Role Expectations
- admin: all operations
- operations: account and transfer operations
- auditor: read-only access to ledger and audit/fraud views
- service: internal system communication

---

## 5. Account Service APIs

## 5.1 Create Account

**POST** `/api/v1/accounts`

### Request
```json
{
  "external_customer_id": "CUS-10001",
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "+1000000000",
  "currency": "USD",
  "initial_balance": 500.00
}
```

### Response `201 Created`
```json
{
  "account_id": "uuid",
  "account_number": "1000000001",
  "external_customer_id": "CUS-10001",
  "full_name": "John Doe",
  "currency": "USD",
  "balance": 500.00,
  "available_balance": 500.00,
  "status": "ACTIVE",
  "created_at": "2026-03-17T12:00:00Z"
}
```

### Validation Rules
- external_customer_id must be unique
- initial_balance must be >= 0
- currency must be supported

---

## 5.2 Get Account

**GET** `/api/v1/accounts/{account_id}`

### Response `200 OK`
```json
{
  "account_id": "uuid",
  "account_number": "1000000001",
  "external_customer_id": "CUS-10001",
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "+1000000000",
  "currency": "USD",
  "balance": 500.00,
  "available_balance": 500.00,
  "status": "ACTIVE",
  "created_at": "2026-03-17T12:00:00Z",
  "updated_at": "2026-03-17T12:00:00Z"
}
```

---

## 5.3 Freeze Account

**POST** `/api/v1/accounts/{account_id}/freeze`

### Request
```json
{
  "reason": "Suspicious activity"
}
```

### Response `200 OK`
```json
{
  "account_id": "uuid",
  "status": "FROZEN",
  "reason": "Suspicious activity",
  "updated_at": "2026-03-17T12:30:00Z"
}
```

---

## 5.4 Unfreeze Account

**POST** `/api/v1/accounts/{account_id}/unfreeze`

### Response `200 OK`
```json
{
  "account_id": "uuid",
  "status": "ACTIVE",
  "updated_at": "2026-03-17T13:00:00Z"
}
```

---

## 5.5 Get Account Balance

**GET** `/api/v1/accounts/{account_id}/balance`

### Response `200 OK`
```json
{
  "account_id": "uuid",
  "currency": "USD",
  "balance": 500.00,
  "available_balance": 500.00,
  "as_of": "2026-03-17T13:05:00Z"
}
```

---

## 6. Transfer Service APIs

## 6.1 Create Transfer

**POST** `/api/v1/transfers`

Required header:
- `Idempotency-Key`

### Request
```json
{
  "sender_account_id": "uuid",
  "receiver_account_id": "uuid",
  "amount": 150.00,
  "currency": "USD",
  "description": "Invoice settlement"
}
```

### Response `201 Created`
```json
{
  "transaction_id": "uuid",
  "transaction_reference": "TXN-20260317-000001",
  "status": "COMPLETED",
  "sender_account_id": "uuid",
  "receiver_account_id": "uuid",
  "amount": 150.00,
  "currency": "USD",
  "processed_at": "2026-03-17T13:10:00Z",
  "correlation_id": "uuid"
}
```

### Failure Examples
#### `409 Conflict` — Idempotency conflict
```json
{
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "The same idempotency key was used with a different payload."
  },
  "correlation_id": "uuid",
  "timestamp": "2026-03-17T13:10:00Z"
}
```

#### `422 Unprocessable Entity` — Insufficient funds
```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "The sender account does not have sufficient balance."
  },
  "correlation_id": "uuid",
  "timestamp": "2026-03-17T13:10:00Z"
}
```

---

## 6.2 Get Transfer

**GET** `/api/v1/transfers/{transaction_id}`

### Response `200 OK`
```json
{
  "transaction_id": "uuid",
  "transaction_reference": "TXN-20260317-000001",
  "sender_account_id": "uuid",
  "receiver_account_id": "uuid",
  "amount": 150.00,
  "currency": "USD",
  "status": "COMPLETED",
  "requested_at": "2026-03-17T13:09:58Z",
  "processed_at": "2026-03-17T13:10:00Z",
  "failure_code": null,
  "failure_reason": null,
  "correlation_id": "uuid"
}
```

---

## 6.3 List Transfers by Account

**GET** `/api/v1/transfers?account_id={account_id}&status=COMPLETED&page=1&page_size=20`

### Response `200 OK`
```json
{
  "data": [
    {
      "transaction_id": "uuid",
      "transaction_reference": "TXN-20260317-000001",
      "amount": 150.00,
      "currency": "USD",
      "status": "COMPLETED",
      "requested_at": "2026-03-17T13:09:58Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_records": 1
  }
}
```

---

## 7. Ledger Service APIs

## 7.1 Get Ledger Entries by Transaction

**GET** `/api/v1/ledger/transactions/{transaction_id}`

### Response `200 OK`
```json
{
  "transaction_id": "uuid",
  "entries": [
    {
      "ledger_entry_id": "uuid",
      "entry_type": "DEBIT",
      "account_id": "sender-uuid",
      "amount": 150.00,
      "currency": "USD",
      "occurred_at": "2026-03-17T13:10:00Z"
    },
    {
      "ledger_entry_id": "uuid",
      "entry_type": "CREDIT",
      "account_id": "receiver-uuid",
      "amount": 150.00,
      "currency": "USD",
      "occurred_at": "2026-03-17T13:10:00Z"
    }
  ]
}
```

---

## 7.2 Get Ledger Entries by Account

**GET** `/api/v1/ledger/accounts/{account_id}?page=1&page_size=50`

### Response `200 OK`
```json
{
  "account_id": "uuid",
  "entries": [
    {
      "ledger_entry_id": "uuid",
      "transaction_id": "uuid",
      "entry_type": "DEBIT",
      "amount": 150.00,
      "currency": "USD",
      "occurred_at": "2026-03-17T13:10:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total_records": 1
  }
}
```

---

## 8. Fraud Service APIs

## 8.1 List Fraud Alerts

**GET** `/api/v1/fraud-alerts?status=OPEN&severity=HIGH&page=1&page_size=20`

### Response `200 OK`
```json
{
  "data": [
    {
      "alert_id": "uuid",
      "transaction_id": "uuid",
      "risk_score": 92.50,
      "severity": "HIGH",
      "status": "OPEN",
      "primary_reason": "High transfer amount",
      "created_at": "2026-03-17T13:10:01Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_records": 1
  }
}
```

---

## 8.2 Get Fraud Alert Details

**GET** `/api/v1/fraud-alerts/{alert_id}`

### Response `200 OK`
```json
{
  "alert_id": "uuid",
  "transaction_id": "uuid",
  "risk_score": 92.50,
  "severity": "HIGH",
  "status": "OPEN",
  "primary_reason": "High transfer amount",
  "rule_hits": [
    {
      "rule_code": "HIGH_AMOUNT",
      "rule_name": "Transfer amount above threshold",
      "score_contribution": 70.00,
      "details": {
        "threshold": 10000,
        "actual_amount": 15000
      }
    }
  ],
  "created_at": "2026-03-17T13:10:01Z"
}
```

---

## 8.3 Review Fraud Alert

**POST** `/api/v1/fraud-alerts/{alert_id}/review`

### Request
```json
{
  "status": "CONFIRMED",
  "review_notes": "Confirmed suspicious activity"
}
```

### Response `200 OK`
```json
{
  "alert_id": "uuid",
  "status": "CONFIRMED",
  "reviewed_at": "2026-03-17T13:20:00Z",
  "reviewed_by": "ops-user"
}
```

---

## 9. Health and Ops APIs

## 9.1 Liveness
**GET** `/health/live`

Response:
```json
{
  "status": "UP"
}
```

## 9.2 Readiness
**GET** `/health/ready`

Response:
```json
{
  "status": "UP",
  "dependencies": {
    "database": "UP",
    "broker": "UP"
  }
}
```

## 9.3 Metrics
**GET** `/metrics`

Response:
- Prometheus text format

---

## 10. Event Contracts

## 10.1 `transfer.completed`

```json
{
  "event_id": "uuid",
  "event_type": "transfer.completed",
  "occurred_at": "2026-03-17T13:10:00Z",
  "correlation_id": "uuid",
  "producer": "transfer-service",
  "payload": {
    "transaction_id": "uuid",
    "transaction_reference": "TXN-20260317-000001",
    "sender_account_id": "uuid",
    "receiver_account_id": "uuid",
    "amount": 150.00,
    "currency": "USD"
  }
}
```

## 10.2 `fraud.alert.created`

```json
{
  "event_id": "uuid",
  "event_type": "fraud.alert.created",
  "occurred_at": "2026-03-17T13:10:01Z",
  "correlation_id": "uuid",
  "producer": "fraud-service",
  "payload": {
    "alert_id": "uuid",
    "transaction_id": "uuid",
    "severity": "HIGH",
    "risk_score": 92.50,
    "primary_reason": "High transfer amount"
  }
}
```

---

## 11. API Design Rules

- all POST write operations must return correlation id
- all paginated endpoints must return pagination metadata
- auditors get read-only access
- transfer write path must not depend on downstream fraud/notification completion
- all enums must be documented and validated server-side
- error codes must be stable for clients and tests
