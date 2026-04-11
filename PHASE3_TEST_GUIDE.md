# Phase 3: API Gateway & Security Verification Guide

This guide provides step-by-step instructions to verify the **API Gateway** implementation, including security policies, infrastructure isolation, and service routing.

---

## 1. Infrastructure Status
Verify that the full stack is healthy and unified under the `banking-net` network.

```powershell
# All containers should be 'Up' and 'Healthy'
docker compose ps
```

### Port Isolation Test (Crucial)
Internal microservices should NO LONGER be accessible from your host machine.
```powershell
# These SHOULD ALL FAIL with "Connection Refused"
curl.exe -i http://localhost:3001/health  # Account
curl.exe -i http://localhost:3002/health  # Transfer
curl.exe -i http://localhost:3003/health  # Ledger
```

---

## 2. Gateway Health Aggregator
The Gateway (Port 8080) can "see" all internal services and report their status.

```powershell
# Should return 200 OK with a JSON map of all services
Invoke-RestMethod -Uri "http://localhost:8080/health"
```

---

## 3. Authentication Lifecycle
Test the full JWT flow with Redis session management.

### Step A: Register
```powershell
$reg = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/v1/auth/register" `
  -ContentType "application/json" `
  -Body '{"email": "tester@example.com", "password": "password123"}'
$reg
```

### Step B: Login
```powershell
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/v1/auth/login" `
  -ContentType "application/json" `
  -Body '{"email": "tester@example.com", "password": "password123"}'

# Capture the token for subsequent requests
$token = $login.accessToken
$token
```

### Step C: Use the Token (Protected Route)
```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8080/v1/accounts" `
  -Headers @{ Authorization = "Bearer $token" }
```

### Step D: Logout & Blacklisting
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/v1/auth/logout" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body @{ refreshToken = $login.refreshToken } | ConvertTo-Json

# VERIFY: Try using the same token again (Should return 401 Unauthorized)
Invoke-RestMethod -Method Get -Uri "http://localhost:8080/v1/accounts" `
  -Headers @{ Authorization = "Bearer $token" }
```

---

## 4. Rate Limiting
Verify that the Redis-backed rate limiter is protecting the system.

### Global Rate Limit
Run the following multiple times. Default is 200 requests/minute.
```powershell
1..5 | ForEach-Object { Invoke-RestMethod -Uri "http://localhost:8080/health" }
```

### Login Brute-Force Protection
The login limit is strict (10 tries/minute).
```powershell
# Run this 11 times. The 11th should return 429 Too Many Requests
1..11 | ForEach-Object { 
    try { Invoke-RestMethod -Method Post -Uri "http://localhost:8080/v1/auth/login" -Body '{"email":"x","password":"y"}' } 
    catch { $_.Exception.Message } 
}
```

---

## 5. Idempotency (Transfers)
Ensure duplicate transfer requests are rejected gracefully.

```powershell
$transferBody = '{"fromAccount": "A", "toAccount": "B", "amount": 10.00}'

# 1st Attempt (Should reach service)
curl.exe -i -X POST http://localhost:8080/v1/transfers `
  -H "Authorization: Bearer $token" `
  -H "Idempotency-Key: unique-key-001" `
  -H "Content-Type: application/json" `
  -d $transferBody

# 2nd Attempt (Should return cached response from Gateway)
# Look for 'Idempotency-Status: hit' in the headers
curl.exe -i -X POST http://localhost:8080/v1/transfers `
  -H "Authorization: Bearer $token" `
  -H "Idempotency-Key: unique-key-001" `
  -H "Content-Type: application/json" `
  -d $transferBody
```

---

## 6. Access Control (RBAC)
Verify that 'customer' users cannot access 'admin' routes.

```powershell
# This should return 403 Forbidden
try { 
    Invoke-RestMethod -Method Get -Uri "http://localhost:8080/v1/fraud" -Headers @{ Authorization = "Bearer $token" } 
} catch { 
    $_.Exception.Response.StatusCode 
}
```

---

> [!IMPORTANT]
> **Logs Monitoring**: During all tests, you can watch the Gateway logs in real-time to see the security layers in action:
> `docker compose logs -f api-gateway`
