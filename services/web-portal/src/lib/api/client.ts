export interface ApiSuccess<T> {
  ok: true;
  status: number;
  data: T;
}

export interface ApiFailure {
  ok: false;
  status: number;
  error: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export const requestJson = async <T>(url: string, init?: RequestInit): Promise<ApiResult<T>> => {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...init?.headers },
      ...init
    });

    const data = (await response.json().catch(() => null)) as T | { error?: string } | null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error:
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "request_failed"
      };
    }

    return { ok: true, status: response.status, data: data as T };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "network_error"
    };
  }
};
