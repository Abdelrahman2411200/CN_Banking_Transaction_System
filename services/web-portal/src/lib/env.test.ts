import { afterEach, describe, expect, it } from "vitest";
import { getApiBaseUrl } from "./env";

describe("runtime environment", () => {
  afterEach(() => {
    delete window.__CN_BANKING_CONFIG__;
  });

  it("uses runtime API configuration before build-time defaults", () => {
    window.__CN_BANKING_CONFIG__ = {
      apiBaseUrl: "https://api.cn-banking.example.com/"
    };

    expect(getApiBaseUrl()).toBe("https://api.cn-banking.example.com");
  });

  it("normalizes the local or build-time gateway URL", () => {
    expect(getApiBaseUrl()).toMatch(/^https?:\/\//);
    expect(getApiBaseUrl()).not.toMatch(/\/$/);
  });
});
