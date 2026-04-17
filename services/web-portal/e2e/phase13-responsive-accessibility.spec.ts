import { expect, test, type Page, type Route } from "@playwright/test";

const sessionStorageKey = "cn-banking.web-portal.auth";
const accountId = "123e4567-e89b-12d3-a456-426614174000";
const reserveAccountId = "223e4567-e89b-12d3-a456-426614174111";
const transferId = "323e4567-e89b-12d3-a456-426614174222";
const alertId = "423e4567-e89b-12d3-a456-426614174333";

const account = {
  balance: "4200.00",
  created_at: "2026-04-13T10:00:00.000Z",
  email: "operator@example.com",
  id: accountId,
  kyc_status: "verified",
  name: "Primary Checking",
  status: "active",
  updated_at: "2026-04-13T12:00:00.000Z"
};

const transfer = {
  amount: "250.00",
  created_at: "2026-04-13T12:00:00.000Z",
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
  to_account_id: reserveAccountId,
  updated_at: "2026-04-13T12:03:00.000Z"
};

const ledgerEntry = {
  account_id: accountId,
  amount: "250.00",
  created_at: "2026-04-13T12:03:00.000Z",
  entry_id: "ledger-entry-e2e-001",
  entry_type: "debit",
  from_account_id: accountId,
  source_event: "bank.transfer.completed",
  status: "completed",
  to_account_id: reserveAccountId,
  transfer_id: transferId
};

const fraudAlert = {
  alert_id: alertId,
  amount: "250.00",
  created_at: "2026-04-13T12:04:00.000Z",
  from_account_id: accountId,
  rule_triggered: "velocity_threshold",
  severity: "critical",
  source_event_id: "fraud-event-e2e-001",
  transfer_id: transferId
};

const representativeRoutes = [
  { path: "/login", readyText: "Architectural Access" },
  { path: "/dashboard", readyText: "Operational Overview" },
  { path: "/accounts", readyText: "Account Ecosystem" },
  { path: "/transfers", readyText: "Transfer Funds" },
  { path: "/ledger", readyText: "Ledger Audit" },
  { path: "/fraud", readyText: "Active Fraud Stream" },
  { path: "/notifications", readyText: "Notification Hub" },
  { path: "/observability", readyText: "Operational Health" },
  { path: "/platform-health", readyText: "Runtime Readiness" }
] as const;

const fulfillJson = async (route: Route, json: unknown, status = 200): Promise<void> => {
  await route.fulfill({
    body: JSON.stringify(json),
    contentType: "application/json",
    status
  });
};

const installGatewayMocks = async (page: Page): Promise<void> => {
  await page.addInitScript((key) => {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        accessToken: "e2e-admin-token",
        role: "admin",
        subject: "admin-e2e"
      })
    );
  }, sessionStorageKey);

  await page.route("**/health", async (route) => {
    await fulfillJson(route, {
      services: {
        "account-service": "ok",
        "api-gateway": "ok",
        "fraud-service": "ok",
        "ledger-service": "ok",
        "notification-service": "ok",
        "transfer-service": "ok"
      },
      status: "ok"
    });
  });

  await page.route("**/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/v1/accounts") {
      await fulfillJson(route, { data: [account], success: true }, route.request().method() === "POST" ? 201 : 200);
      return;
    }

    if (path.endsWith("/balance")) {
      await fulfillJson(route, { data: { balance: account.balance, id: account.id }, success: true });
      return;
    }

    if (path.endsWith("/kyc") || path.endsWith("/freeze") || /^\/v1\/accounts\/[^/]+$/.test(path)) {
      await fulfillJson(route, { data: account, success: true });
      return;
    }

    if (path === "/v1/transfers") {
      await fulfillJson(route, { data: [transfer], success: true }, route.request().method() === "POST" ? 201 : 200);
      return;
    }

    if (/^\/v1\/transfers\/[^/]+$/.test(path)) {
      await fulfillJson(route, { data: transfer, success: true });
      return;
    }

    if (path.startsWith("/v1/ledger/stats/")) {
      await fulfillJson(route, {
        data: {
          entryCount: 2,
          net: -250,
          totalCredits: 0,
          totalDebits: 250
        },
        success: true
      });
      return;
    }

    if (path.startsWith("/v1/ledger/transfer/") || /^\/v1\/ledger\/[^/]+$/.test(path)) {
      await fulfillJson(route, { data: [ledgerEntry], success: true });
      return;
    }

    if (path === "/v1/fraud/stats") {
      await fulfillJson(route, {
        today: [{ count: 1, severity: "critical" }],
        thisWeek: [{ count: 1, severity: "critical" }]
      });
      return;
    }

    if (path === "/v1/fraud/alerts") {
      await fulfillJson(route, { data: [fraudAlert], success: true });
      return;
    }

    if (/^\/v1\/fraud\/alerts\/[^/]+$/.test(path)) {
      await fulfillJson(route, { data: fraudAlert, success: true });
      return;
    }

    if (path === "/v1/notifications") {
      await fulfillJson(route, {
        data: {
          channels: ["email", "sms"],
          mode: "gateway",
          notifications: [
            {
              channel: "email",
              created_at: "2026-04-13T12:05:00.000Z",
              id: "notification-e2e-001",
              message: "Transfer completed",
              recipient: "operator@example.com",
              status: "sent",
              subject: "Transfer update",
              topic: "bank.transfer.completed",
              type: "transfer.completed"
            }
          ],
          persistence: "gateway",
          subscribed_topics: ["bank.transfer.completed"]
        },
        success: true
      });
      return;
    }

    await fulfillJson(route, { error: "not_found", success: false }, 404);
  });
};

const assertNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const overflowReport = await page.evaluate(() => {
    const overflow = Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      document.body.scrollWidth - document.body.clientWidth
    );
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
      .filter((node) => {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.right > viewportWidth + 2
        );
      })
      .slice(0, 8)
      .map((node) => {
        const rect = node.getBoundingClientRect();

        return {
          className: node.className,
          right: Math.round(rect.right),
          tagName: node.tagName.toLowerCase(),
          text: node.innerText?.trim().slice(0, 80),
          width: Math.round(rect.width)
        };
      });

    return { offenders, overflow };
  });

  expect(overflowReport).toEqual({ offenders: [], overflow: 0 });
};

const assertNoVisibleTextOverflow = async (page: Page): Promise<void> => {
  const offenders = await page.locator(
    "main, nav, article, section, table, th, td, button, input, select, textarea, a, span, p, h1, h2, h3, h4, dd, dt"
  ).evaluateAll((elements) =>
    elements
      .filter((element) => {
        const node = element as HTMLElement;
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const text = node.innerText?.trim() || node.getAttribute("value") || "";

        if (
          !text ||
          rect.width < 1 ||
          rect.height < 1 ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          node.classList.contains("material-symbols-outlined") ||
          node.classList.contains("sr-only") ||
          node.closest("[aria-hidden='true']")
        ) {
          return false;
        }

        return node.scrollWidth - node.clientWidth > 2 && style.overflowX !== "auto" && style.overflowX !== "scroll";
      })
      .slice(0, 8)
      .map((element) => {
        const node = element as HTMLElement;
        const rect = node.getBoundingClientRect();

        return {
          className: node.className,
          tagName: node.tagName.toLowerCase(),
          text: node.innerText.trim().slice(0, 80),
          width: Math.round(rect.width),
          scrollWidth: node.scrollWidth
        };
      })
  );

  expect(offenders).toEqual([]);
};

test.beforeEach(async ({ page }) => {
  await installGatewayMocks(page);
});

test("representative routes render at Phase 13 breakpoints without visible overflow", async ({ page }, testInfo) => {
  for (const route of representativeRoutes) {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(route.readyText).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertNoVisibleTextOverflow(page);

    const screenshotName = `${testInfo.project.name}-${route.path.replace(/\W+/g, "-").replace(/^-|-$/g, "")}.png`;
    await page.screenshot({ fullPage: true, path: testInfo.outputPath(screenshotName) });
  }
});

test("keyboard navigation reaches shell, filters, forms, and icon-only controls", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Operational Overview")).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /skip to workspace/i })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main", { name: /portal workspace/i })).toBeFocused();

  await page.goto("/fraud", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Active Fraud Stream")).toBeVisible();

  await page.getByLabel("Severity").focus();
  await expect(page.getByLabel("Severity")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Account UUID")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Transfer UUID")).toBeFocused();

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /show password/i })).toBeVisible();
  await page.getByRole("button", { name: /show password/i }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /hide password/i })).toBeFocused();
});
