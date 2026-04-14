import { expect, test } from "@playwright/test";

const sessionStorageKey = "cn-banking.web-portal.auth";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        accessToken: "e2e-operator-token",
        role: "operator",
        subject: "operator-e2e"
      })
    );
  }, sessionStorageKey);

  await page.route("**/health", async (route) => {
    await route.fulfill({
      json: {
        services: { account: "ok", ledger: "ok", transfer: "ok" },
        status: "ok"
      },
      status: 200
    });
  });

  await page.route("**/v1/accounts", async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            balance: "4200.00",
            created_at: "2026-04-13T10:00:00.000Z",
            email: "operator@example.com",
            id: "acct-e2e-primary",
            kyc_status: "verified",
            name: "Primary Checking",
            status: "active",
            updated_at: "2026-04-13T12:00:00.000Z"
          }
        ],
        success: true
      },
      status: 200
    });
  });

  await page.route("**/v1/transfers", async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            amount: "250.00",
            created_at: "2026-04-13T12:00:00.000Z",
            from_account_id: "acct-e2e-primary",
            id: "transfer-e2e-001",
            status: "completed",
            to_account_id: "acct-e2e-reserve",
            updated_at: "2026-04-13T12:03:00.000Z"
          }
        ],
        success: true
      },
      status: 200
    });
  });
});

test("operator can open the routed dashboard overview", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Banking Ops" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Operational Overview")).toBeVisible();
  await expect(page.getByText("$4,200.00").first()).toBeVisible();
  await expect(page.getByText("transfer-e2e-001")).toBeVisible();
  await expect(page.getByRole("link", { name: /Review Fraud/i })).toBeVisible();
  await expect(page.getByText("Gateway healthy")).toBeVisible();
});
