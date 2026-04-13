export const authStorageKey = "cn-banking.web-portal.auth";

export type UserRole = "customer" | "operator" | "admin";

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  role: UserRole;
  subject?: string;
  expiresAt?: number;
  requestId?: string;
}

export interface StoredAuthSession {
  refreshToken?: string;
  role?: UserRole;
  subject?: string;
  expiresAt?: number;
}

interface JwtClaims {
  sub?: string;
  role?: string;
  roles?: string[];
}

const userRoles: UserRole[] = ["customer", "operator", "admin"];
let inMemorySession: AuthSession | null = null;

const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" && userRoles.includes(value as UserRole);

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(`${normalized}${padding}`);
};

export const parseJwtSession = (
  accessToken: string,
  overrides: Partial<Omit<AuthSession, "accessToken" | "role">> = {}
): AuthSession | null => {
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
      ...overrides,
      role,
      subject: claims.sub
    };
  } catch {
    return null;
  }
};

export const setInMemorySession = (session: AuthSession | null): void => {
  inMemorySession = session;
};

export const writeStoredSession = (
  session: AuthSession,
  storage: Storage = window.sessionStorage
): void => {
  inMemorySession = session;

  const storedSession: StoredAuthSession = {
    refreshToken: session.refreshToken,
    role: session.role,
    subject: session.subject,
    expiresAt: session.expiresAt
  };

  storage.setItem(authStorageKey, JSON.stringify(storedSession));
};

export const clearStoredSession = (storage: Storage = window.sessionStorage): void => {
  inMemorySession = null;
  storage.removeItem(authStorageKey);
};

export const readRefreshToken = (storage: Storage = window.sessionStorage): string | null => {
  if (inMemorySession?.refreshToken) {
    return inMemorySession.refreshToken;
  }

  const rawSession = storage.getItem(authStorageKey);

  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as StoredAuthSession;
    return typeof parsed.refreshToken === "string" ? parsed.refreshToken : null;
  } catch {
    return null;
  }
};

export const readStoredSession = (storage: Storage = window.sessionStorage): AuthSession | null => {
  if (inMemorySession) {
    return inMemorySession;
  }

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
      const subject = typeof parsed.subject === "string" ? parsed.subject : undefined;
      const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : undefined;
      const refreshToken = typeof parsed.refreshToken === "string" ? parsed.refreshToken : undefined;

      if (typeof parsed.accessToken === "string") {
        return {
          accessToken: parsed.accessToken,
          refreshToken,
          role: parsed.role,
          subject,
          expiresAt
        };
      }

      return null;
    }

    return parseJwtSession(parsed.accessToken);
  } catch {
    return parseJwtSession(rawSession);
  }
};
