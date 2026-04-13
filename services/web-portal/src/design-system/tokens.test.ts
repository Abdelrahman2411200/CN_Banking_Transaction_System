import { describe, expect, it } from "vitest";
import { designTokens, semanticTokens, surfaceTokens } from "./tokens";

describe("design tokens", () => {
  it("defines the required Vault Protocol surface tokens", () => {
    expect(Object.keys(surfaceTokens)).toEqual(
      expect.arrayContaining([
        "surface",
        "surface-container-low",
        "surface-container-lowest",
        "surface-container-highest",
        "on-surface"
      ])
    );
  });

  it("defines semantic status colors", () => {
    expect(Object.keys(semanticTokens)).toEqual(
      expect.arrayContaining(["success", "warning", "error", "info", "neutral"])
    );
  });

  it("keeps token names unique", () => {
    const names = designTokens.map((token) => token.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
