import {
  clearStoredSession,
  parseJwtSession,
  readRefreshToken,
  readStoredSession,
  writeStoredSession,
  type AuthSession,
  type UserRole
} from "../../app/auth/session";
import { getApiBaseUrl } from "../env";
import { jsonRequest, requestJson, type ApiResult } from "./client";

export interface RegisterRequest {
  email: string;
  password: string;
  role?: Extract<UserRole, "customer" | "admin">;
}

export interface RegisterResponse {
  userId: string;
  email: string;
  role: Extract<UserRole, "customer" | "admin">;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export interface AuthClientOptions {
  baseUrl?: string;
  storage?: Storage;
}

const expiresAtFromSeconds = (expiresIn: number, now = Date.now()): number =>
  now + expiresIn * 1000;

const sessionFromLogin = (response: LoginResponse, requestId?: string): AuthSession | null =>
  parseJwtSession(response.accessToken, {
    refreshToken: response.refreshToken,
    expiresAt: expiresAtFromSeconds(response.expiresIn),
    requestId
  });

const sessionFromRefresh = (
  response: RefreshResponse,
  refreshToken: string,
  requestId?: string
): AuthSession | null =>
  parseJwtSession(response.accessToken, {
    refreshToken,
    expiresAt: expiresAtFromSeconds(response.expiresIn),
    requestId
  });

const authUrl = (path: string, baseUrl = getApiBaseUrl()): string => `${baseUrl}/v1/auth${path}`;

export const registerUser = (
  input: RegisterRequest,
  options: AuthClientOptions = {}
): Promise<ApiResult<RegisterResponse>> =>
  requestJson<RegisterResponse>(authUrl("/register", options.baseUrl), jsonRequest("POST", input));

export const loginUser = async (
  input: LoginRequest,
  options: AuthClientOptions = {}
): Promise<ApiResult<AuthSession>> => {
  const result = await requestJson<LoginResponse>(authUrl("/login", options.baseUrl), jsonRequest("POST", input));

  if (!result.ok) {
    return result;
  }

  const session = sessionFromLogin(result.data, result.requestId);

  if (!session) {
    return {
      ok: false,
      status: result.status,
      error: "invalid_auth_response",
      requestId: result.requestId
    };
  }

  writeStoredSession(session, options.storage);

  return { ok: true, status: result.status, data: session, requestId: result.requestId };
};

export const refreshAuthSession = async (
  options: AuthClientOptions = {}
): Promise<ApiResult<AuthSession>> => {
  const refreshToken = readRefreshToken(options.storage);

  if (!refreshToken) {
    return { ok: false, status: 401, error: "refresh_token_required" };
  }

  const result = await requestJson<RefreshResponse>(
    authUrl("/refresh", options.baseUrl),
    jsonRequest("POST", { refreshToken })
  );

  if (!result.ok) {
    return result;
  }

  const session = sessionFromRefresh(result.data, refreshToken, result.requestId);

  if (!session) {
    return {
      ok: false,
      status: result.status,
      error: "invalid_auth_response",
      requestId: result.requestId
    };
  }

  writeStoredSession(session, options.storage);

  return { ok: true, status: result.status, data: session, requestId: result.requestId };
};

export const logoutUser = async (options: AuthClientOptions = {}): Promise<ApiResult<null>> => {
  const session = readStoredSession(options.storage);
  const refreshToken = readRefreshToken(options.storage);
  const result = await requestJson<null>(authUrl("/logout", options.baseUrl), {
    ...jsonRequest("POST", { refreshToken }),
    accessToken: session?.accessToken,
    retryOnUnauthorized: false
  });

  clearStoredSession(options.storage);

  if (!result.ok) {
    return result;
  }

  return { ok: true, status: result.status, data: null, requestId: result.requestId };
};

export const refreshAccessTokenForRetry = async (
  options: AuthClientOptions = {}
): Promise<string | null> => {
  const result = await refreshAuthSession(options);
  return result.ok ? result.data.accessToken : null;
};
