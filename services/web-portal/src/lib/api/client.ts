export interface ApiSuccess<T> {
  ok: true;
  status: number;
  data: T;
  requestId?: string;
}

export interface ApiFailure {
  ok: false;
  status: number;
  error: string;
  requestId?: string;
  retryAfter?: number;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type AccessTokenProvider = string | (() => string | null);

export interface ApiRequestInit extends RequestInit {
  accessToken?: AccessTokenProvider;
  refreshAccessToken?: () => Promise<string | null>;
  retryOnUnauthorized?: boolean;
}

interface GatewayErrorBody {
  error?: string | { code?: string; message?: string };
  message?: string;
  retryAfter?: number;
}

const defaultErrorByStatus: Record<number, string> = {
  400: "validation_failed",
  401: "invalid_token",
  403: "forbidden",
  404: "not_found",
  429: "rate_limit_exceeded",
  500: "internal_error",
  503: "service_degraded"
};

const getAccessToken = (provider?: AccessTokenProvider): string | null => {
  if (!provider) {
    return null;
  }

  return typeof provider === "string" ? provider : provider();
};

const getRequestId = (headers: Headers): string | undefined =>
  headers.get("x-request-id") ?? headers.get("X-Request-Id") ?? undefined;

const toRetryAfter = (headers: Headers, body: GatewayErrorBody | null): number | undefined => {
  const headerValue = headers.get("retry-after");
  const parsedHeader = headerValue ? Number(headerValue) : NaN;

  if (Number.isFinite(parsedHeader)) {
    return parsedHeader;
  }

  return typeof body?.retryAfter === "number" ? body.retryAfter : undefined;
};

const parseResponseJson = async <T>(response: Response): Promise<T | GatewayErrorBody | null> => {
  if (response.status === 204) {
    return null;
  }

  return (await response.json().catch(() => null)) as T | GatewayErrorBody | null;
};

const normalizeGatewayError = (
  status: number,
  data: GatewayErrorBody | null,
  requestId?: string,
  retryAfter?: number,
  fallback = "request_failed"
): ApiFailure => {
  const nestedCode =
    data && typeof data.error === "object" && typeof data.error.code === "string"
      ? data.error.code.toLowerCase()
      : undefined;

  return {
    ok: false,
    status,
    error:
      data && typeof data.error === "string"
        ? data.error
        : nestedCode ?? defaultErrorByStatus[status] ?? fallback,
    requestId,
    retryAfter
  };
};

const buildHeaders = (init?: ApiRequestInit, accessToken?: string | null): Headers => {
  const headers = new Headers(init?.headers);
  headers.set("Accept", headers.get("Accept") ?? "application/json");

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return headers;
};

const toFetchInit = (init?: ApiRequestInit): RequestInit => {
  if (!init) {
    return {};
  }

  const requestInit: RequestInit = { ...init };
  delete (requestInit as ApiRequestInit).accessToken;
  delete (requestInit as ApiRequestInit).refreshAccessToken;
  delete (requestInit as ApiRequestInit).retryOnUnauthorized;
  return requestInit;
};

export const jsonRequest = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? undefined : { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body)
});

export const requestJson = async <T>(url: string, init?: ApiRequestInit): Promise<ApiResult<T>> => {
  const attempt = async (accessToken?: string | null): Promise<ApiResult<T>> => {
    const response = await fetch(url, {
      ...toFetchInit(init),
      headers: buildHeaders(init, accessToken)
    });

    const data = await parseResponseJson<T>(response);
    const requestId = getRequestId(response.headers);

    if (!response.ok) {
      return normalizeGatewayError(
        response.status,
        data as GatewayErrorBody | null,
        requestId,
        toRetryAfter(response.headers, data as GatewayErrorBody | null)
      );
    }

    return { ok: true, status: response.status, data: data as T, requestId };
  };

  try {
    const accessToken = getAccessToken(init?.accessToken);
    const firstResult = await attempt(accessToken);

    if (
      !firstResult.ok &&
      firstResult.status === 401 &&
      init?.refreshAccessToken &&
      init.retryOnUnauthorized !== false
    ) {
      const refreshedToken = await init.refreshAccessToken();

      if (refreshedToken) {
        return attempt(refreshedToken);
      }
    }

    return firstResult;
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "network_error"
    };
  }
};
