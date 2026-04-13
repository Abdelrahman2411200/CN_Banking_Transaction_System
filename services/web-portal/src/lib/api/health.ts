import { getApiBaseUrl } from "../env";
import { requestJson } from "./client";

export type GatewayHealthStatus = "healthy" | "degraded" | "unavailable";

export interface GatewayHealthResponse {
  status: "ok" | "degraded";
  services?: Record<string, "ok" | "degraded" | "unreachable">;
}

export interface GatewayHealthState {
  status: GatewayHealthStatus;
  services: Record<string, string>;
  message: string;
}

export const mapGatewayHealth = (response: GatewayHealthResponse): GatewayHealthState => ({
  status: response.status === "ok" ? "healthy" : "degraded",
  services: response.services ?? {},
  message: response.status === "ok" ? "Gateway healthy" : "Gateway degraded"
});

export const getGatewayHealth = async (baseUrl = getApiBaseUrl()): Promise<GatewayHealthState> => {
  const result = await requestJson<GatewayHealthResponse>(`${baseUrl}/health`);

  if (!result.ok) {
    return {
      status: "unavailable",
      services: {},
      message: result.error || "Gateway unavailable"
    };
  }

  return mapGatewayHealth(result.data);
};
