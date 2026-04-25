const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

declare global {
  interface Window {
    __CN_BANKING_CONFIG__?: {
      apiBaseUrl?: string;
    };
  }
}

export const getApiBaseUrl = (): string => {
  const configured =
    window.__CN_BANKING_CONFIG__?.apiBaseUrl ||
    (import.meta.env.VITE_API_BASE_URL as string | undefined);

  return trimTrailingSlash(configured || "http://localhost:8080");
};
