const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

export const getApiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return trimTrailingSlash(configured || "http://localhost:8080");
};
