export const authStorageKey = "cn-banking.web-portal.auth";

export type UserRole = "customer" | "operator" | "admin";

export interface AuthSession {
  accessToken: string;
  role: UserRole;
  subject?: string;
}

interface JwtClaims {
  sub?: string;
  role?: string;
  roles?: string[];
}

const userRoles: UserRole[] = ["customer", "operator", "admin"];

const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" && userRoles.includes(value as UserRole);

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(`${normalized}${padding}`);
};

export const parseJwtSession = (accessToken: string): AuthSession | null => {
  const [, payload] = accessToken.split(".");

  if (!payload) {
    return null;
  }

  try {
    const claims = JSON.parse(decodeBase64Url(payload)) as JwtClaims;
    const role = isUserRole(claims.role) ? claims.role : claims.roles?.find(isUserRole);

    if (!role) {
      return null;
    }

    return {
      accessToken,
      role,
      subject: claims.sub
    };
  } catch {
    return null;
  }
};

export const readStoredSession = (storage: Storage = window.localStorage): AuthSession | null => {
  const rawSession = storage.getItem(authStorageKey);

  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as Partial<AuthSession>;

    if (typeof parsed.accessToken !== "string") {
      return null;
    }

    if (isUserRole(parsed.role)) {
      return {
        accessToken: parsed.accessToken,
        role: parsed.role,
        subject: typeof parsed.subject === "string" ? parsed.subject : undefined
      };
    }

    return parseJwtSession(parsed.accessToken);
  } catch {
    return parseJwtSession(rawSession);
  }
};
