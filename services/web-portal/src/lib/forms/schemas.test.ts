import { describe, expect, it } from "vitest";
import {
  accountIdSchema,
  createAccountFormSchema,
  ledgerIdSchema,
  loginFormSchema,
  registerFormSchema,
  toCreateAccountInput,
  toCreateTransferInput,
  toLoginRequest,
  toRegisterRequest,
  transferFormSchema,
  transferIdSchema,
  zodFieldErrors
} from "./schemas";

const sourceAccountId = "123e4567-e89b-12d3-a456-426614174000";
const destinationAccountId = "323e4567-e89b-12d3-a456-426614174222";

describe("portal form schemas", () => {
  it("normalizes login and registration payloads", () => {
    expect(toLoginRequest({ email: "  operator@example.com ", password: "secret-key" })).toEqual({
      email: "operator@example.com",
      password: "secret-key"
    });

    expect(
      toRegisterRequest({
        email: " admin@example.com ",
        fullName: "  Ada Admin ",
        password: "secret-key",
        role: "admin"
      })
    ).toEqual({
      email: "admin@example.com",
      password: "secret-key",
      role: "admin"
    });
  });

  it("returns field-level auth schema errors", () => {
    const result = registerFormSchema.safeParse({
      email: "bad",
      fullName: "A",
      password: "short",
      role: "customer"
    });

    expect(result.success).toBe(false);
    expect(result.success ? {} : zodFieldErrors(result.error)).toEqual({
      email: "Enter a valid institutional email address.",
      fullName: "Enter the registered legal name for this access profile.",
      password: "Access keys must be at least 8 characters."
    });
    expect(loginFormSchema.safeParse({ email: "user@example.com", password: "long-key" }).success).toBe(true);
  });

  it("normalizes account creation payloads and rejects invalid money", () => {
    expect(
      toCreateAccountInput({
        email: " customer@example.com ",
        initialBalance: " 500.50 ",
        name: "  Customer One "
      })
    ).toEqual({
      email: "customer@example.com",
      initialBalance: "500.50",
      name: "Customer One"
    });

    expect(
      createAccountFormSchema.safeParse({
        email: "customer@example.com",
        initialBalance: "10.999",
        name: "Customer One"
      }).success
    ).toBe(false);
  });

  it("normalizes transfer payloads and prevents same-account transfers", () => {
    expect(
      toCreateTransferInput({
        amount: " 125.00 ",
        fromAccountId: ` ${sourceAccountId} `,
        toAccountId: ` ${destinationAccountId} `
      })
    ).toEqual({
      amount: "125.00",
      fromAccountId: sourceAccountId,
      toAccountId: destinationAccountId
    });

    const result = transferFormSchema.safeParse({
      amount: "125.00",
      fromAccountId: sourceAccountId,
      toAccountId: sourceAccountId
    });

    expect(result.success).toBe(false);
    expect(result.success ? {} : zodFieldErrors(result.error)).toEqual({
      toAccountId: "Destination must use a different account UUID."
    });
  });

  it("validates account, transfer, and ledger identifiers", () => {
    expect(accountIdSchema.safeParse(sourceAccountId).success).toBe(true);
    expect(transferIdSchema.safeParse(destinationAccountId).success).toBe(true);
    expect(ledgerIdSchema("account").safeParse("not-a-uuid").success).toBe(false);
  });
});
