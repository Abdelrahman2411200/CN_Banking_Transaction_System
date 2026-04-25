import { z } from "zod";
import type { CreateAccountInput } from "../api/accounts";
import type { LoginRequest, RegisterRequest } from "../api/auth";
import type { CreateTransferInput } from "../api/transfers";

const emailMessage = "Enter a valid institutional email address.";
const accountEmailMessage = "Enter a valid email address.";
const moneyPattern = /^\d+(\.\d{1,2})?$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const trimmedString = z.string().transform((value) => value.trim());

export const loginFormSchema = z.object({
  email: z.string().trim().email(emailMessage),
  password: z.string().min(8, "Access keys must be at least 8 characters.")
});

export const registerFormSchema = loginFormSchema.extend({
  fullName: z.string().trim().min(2, "Enter the registered legal name for this access profile."),
  role: z.enum(["customer", "admin"])
});

export const createAccountFormSchema = z.object({
  email: z.string().trim().email(accountEmailMessage),
  initialBalance: z
    .string()
    .trim()
    .refine((value) => moneyPattern.test(value), "Use a non-negative USD amount with up to 2 decimals."),
  name: z.string().trim().min(2, "Enter the account holder's legal name.")
});

export const accountIdSchema = trimmedString.refine(
  (value) => uuidPattern.test(value),
  "Enter a valid account UUID."
);

export const transferIdSchema = trimmedString.refine(
  (value) => uuidPattern.test(value),
  "Enter a valid transfer UUID."
);

export const ledgerIdSchema = (label: "account" | "transfer") =>
  trimmedString.refine((value) => uuidPattern.test(value), `Enter a valid ${label} UUID.`);

export const transferFormSchema = z
  .object({
    amount: z
      .string()
      .trim()
      .refine(
        (value) => moneyPattern.test(value) && Number(value) > 0,
        "Use a positive USD amount with up to 2 decimals."
      ),
    fromAccountId: z.string().trim().refine((value) => uuidPattern.test(value), "Enter a valid source account UUID."),
    toAccountId: z.string().trim().refine((value) => uuidPattern.test(value), "Enter a valid destination account UUID.")
  })
  .refine(
    (fields) => fields.fromAccountId.toLowerCase() !== fields.toAccountId.toLowerCase(),
    {
      message: "Destination must use a different account UUID.",
      path: ["toAccountId"]
    }
  );

type FieldErrors<T extends string> = Partial<Record<T, string>>;

export const zodFieldErrors = <T extends string>(error: z.ZodError): FieldErrors<T> =>
  error.issues.reduce<FieldErrors<T>>((errors, issue) => {
    const field = issue.path[0];

    if (typeof field === "string" && !errors[field as T]) {
      errors[field as T] = issue.message;
    }

    return errors;
  }, {});

export const firstZodMessage = (error: z.ZodError): string | undefined =>
  error.issues[0]?.message;

export const toLoginRequest = (fields: z.input<typeof loginFormSchema>): LoginRequest =>
  loginFormSchema.parse(fields);

export const toRegisterRequest = (fields: z.input<typeof registerFormSchema>): RegisterRequest => {
  const parsed = registerFormSchema.parse(fields);

  return {
    email: parsed.email,
    password: parsed.password,
    role: parsed.role
  };
};

export const toCreateAccountInput = (
  fields: z.input<typeof createAccountFormSchema>
): CreateAccountInput => createAccountFormSchema.parse(fields);

export const toCreateTransferInput = (
  fields: z.input<typeof transferFormSchema>
): CreateTransferInput => transferFormSchema.parse(fields);
