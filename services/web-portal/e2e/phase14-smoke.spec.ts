import { expect, test, type Page, type Route } from "@playwright/test";

const sessionStorageKey = "cn-banking.web-portal.auth";
const accountId = "123e4567-e89b-12d3-a456-426614174000";
const destinationAccountId = "323e4567-e89b-12d3-a456-426614174222";
const transferId = "223e4567-e89b-12d3-a456-426614174111";

const jwtFor = (role: "admin" | "customer" | "operator"): string => {
  const payload = Buffer.from(JSON.stringify({ role, sub: `${role}-smoke` }), "utf8")
    .toString("base64url");

  return `header.${payload}.signature`;
};

const account = {
  balance: "1000.00",
  created_at: "2026-04-13T10:00:00.000Z",
  email: "evelyn@example.com",
  id: accountId,
  kyc_status: "verified",
  name: "Evelyn Rothschild",
  status: "active",
  updated_at: "2026-04-13T11:00:00.000Z"
};

const transfer = {
  amount: "125.00",
  created_at: "2026-04-14T10:00:00.000Z",
  error_message: null,
  from_account_id: accountId,
  id: transferId,
  saga_state: {
    compensation_completed: false,
    credit_completed: true,
    current_step: "completed",
    debit_completed: true,
    error: null
  },
  status: "completed",
  to_account_id: destinationAccountId,
  updated_at: "2026-04-14T10:01:00.000Z"
};

const ledgerEntry = {
  account_id: accountId,
  amount: "125.00",
  created_at: "2026-04-14T10:01:00.000Z",
  entry_id: "ledger-smoke-001",
  entry_type: "debit",
  from_account_id: accountId,
  source_event: "bank.transfer.completed",
  status: "completed",
  to_account_id: destinationAccountId,
  transfer_id: transferId
};

const fulfillJson = async (route: Route, body: unknown, status = 200): Promise<void> => {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    headers: { "x-request-id": "req-smoke" },
    status
  });
};

const installSession = async (page: Page, role: "admin" | "customer" | "operator" = "admin"): Promise<void> => {
  await page.addInitScript(
    ({ key, token, userRole }) => {
      window.sessionStorage.setItem(
        key,
        JSON.stringify({
          accessToken: token,
          role: userRole,
          subject: `${userRole}-smoke`
        })
      );
    },
    { key: sessionStorageKey, token: jwtFor(role), userRole: role }
  );
};

const installGatewayMocks = async (page: Page): Promise<void> => {
  await page.route("**/health", async (route) => {
    await fulfillJson(route, {
      services: {
        "account-service": "ok",
        "api-gateway": "ok",
        "ledger-service": "degraded",
        "transfer-service": "ok"
      },
      status: "degraded"
    });
  });

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/v1/auth/login") {
      await fulfillJson(route, {
        accessToken: jwtFor("admin"),
        expiresIn: 900,
        refreshToken: "refresh-smoke"
      });
      return;
    }

    if (path === "/v1/auth/logout") {
      await fulfillJson(route, null, 204);
      return;
    }

    if (path === "/v1/accounts") {
      await fulfillJson(route, { data: account, success: true }, request.method() === "POST" ? 201 : 200);
      return;
    }

    if (path === `/v1/accounts/${accountId}/balance`) {
      await fulfillJson(route, { data: { balance: account.balance, id: account.id }, success: true });
      return;
    }

    if (path === `/v1/accounts/${accountId}`) {
      await fulfillJson(route, { data: account, success: true });
      return;
    }

    if (path === "/v1/transfers") {
      await fulfillJson(route, { data: transfer, success: true }, 201);
      return;
    }

    if (path === `/v1/transfers/${transferId}`) {
      await fulfillJson(route, { data: transfer, success: true });
      return;
    }

    if (path === `/v1/ledger/transfer/${transferId}` || path === `/v1/ledger/${accountId}`) {
      await fulfillJson(route, { data: [ledgerEntry], success: true });
      return;
    }

    if (path === `/v1/ledger/stats/${accountId}`) {
      await fulfillJson(route, {
        data: {
          entryCount: 1,
          net: -125,
          totalCredits: 0,
          totalDebits: 125
        },
        success: true
      });
      return;
    }

    if (path === "/v1/fraud/stats") {
      await fulfillJson(route, { thisWeek: [{ count: 1, severity: "high" }], today: [{ count: 1, severity: "high" }] });
      return;
    }

    if (path === "/v1/fraud/alerts") {
      await fulfillJson(route, {
        data: [
          {
            alert_id: "423e4567-e89b-12d3-a456-426614174333",
            amount: "125.00",
            created_at: "2026-04-14T10:02:00.000Z",
            from_account_id: accountId,
            rule_triggered: "velocity_threshold",
            severity: "high",
            source_event_id: "event-smoke",
            transfer_id: transferId
          }
        ],
        success: true
      });
      return;
    }

    await fulfillJson(route, { error: "not_found", success: false }, 404);
  });
};

test.beforeEach(async ({ page }) => {
  await installGatewayMocks(page);
});

test("login and logout smoke flow uses the gateway auth boundary", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/Institutional Email/i).fill("admin@example.com");
  await page.getByLabel(/Encrypted Access Key/i).fill("secret-key");
  await page.getByRole("button", { name: /Initialize Access/i }).click();

  await expect(page.getByText("Active Fraud Stream")).toBeVisible();

  await page.getByRole("button", { name: /Sign out/i }).click();

  await expect(page.getByText("Signed out. Re-authenticate to access the ledger.")).toBeVisible();
});

test("account creation and transfer initiation smoke flows render resulting detail", async ({ page }) => {
  await installSession(page, "operator");
  await page.goto("/accounts");

  await page.getByLabel(/Full Legal Name/i).fill("Evelyn Rothschild");
  await page.getByLabel(/Email Address/i).fill("evelyn@example.com");
  await page.getByLabel(/Initial Reserve USD/i).fill("1000.00");
  await page.getByRole("button", { name: /Generate Identity Record/i }).click();

  await expect(page.getByText("Account Created")).toBeVisible();
  await expect(page.getByText(`UUID: ${accountId}`)).toBeVisible();

  await page.goto("/transfers");
  await page.getByLabel(/Source Account UUID/i).fill(accountId);
  await page.getByLabel(/Destination Account UUID/i).fill(destinationAccountId);
  await page.getByLabel(/Transfer Amount/i).fill("125.00");
  await page.getByRole("button", { name: /^Initiate Transfer$/i }).click();

  await expect(page.getByText("Transfer Initiated")).toBeVisible();
  await expect(page.getByText(`UUID: ${transferId}`)).toBeVisible();
});

test("ledger lookup and admin access smoke flows render operational pages", async ({ page }) => {
  await installSession(page, "admin");
  await page.goto("/ledger");

  await page.getByLabel(/Transfer UUID/i).fill(transferId);
  await page.getByRole("button", { name: /Lookup Transfer Audit/i }).click();

  await expect(page.getByText("Transfer Entries")).toBeVisible();
  await expect(page.getByText("ledger-smoke-001")).toBeVisible();

  await page.goto("/fraud");

  await expect(page.getByText("Active Fraud Stream")).toBeVisible();
  await expect(page.getByText("velocity_threshold")).toBeVisible();
});

test("health dashboard smoke flow renders degraded gateway readiness", async ({ page }) => {
  await installSession(page, "admin");
  await page.goto("/platform-health");

  await expect(page.getByRole("heading", { name: "Runtime Readiness" })).toBeVisible();
  await expect(page.getByText("Gateway degraded")).toBeVisible();
  await expect(page.getByText("ledger-service")).toBeVisible();
});
