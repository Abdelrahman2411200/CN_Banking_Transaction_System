import { describe, expect, it } from "vitest";
import { statusSemantics } from "./status";
import {
  darkSemanticTokens,
  darkSurfaceTokens,
  designTokens,
  migrationDesignDecisions,
  semanticTokens,
  surfaceTokens,
  typographyTokens
} from "./tokens";

const channelToLinear = (channel: number): number =>
  channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const relativeLuminance = (hexColor: string): number => {
  const [red, green, blue] = hexColor
    .replace("#", "")
    .match(/.{2}/g)
    ?.map((value) => channelToLinear(Number.parseInt(value, 16) / 255)) ?? [0, 0, 0];

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrastRatio = (foreground: string, background: string): number => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
};

const classToken = (className: string, prefix: "bg-" | "text-"): string | undefined =>
  className.split(" ").find((part) => part.startsWith(prefix))?.slice(prefix.length);

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

  it("defines the required editorial typography scale", () => {
    expect(Object.keys(typographyTokens)).toEqual(
      expect.arrayContaining(["display-lg", "headline-sm", "title-sm", "body-md", "label-sm"])
    );
  });

  it("records Phase 16 migration decisions in React-owned design metadata", () => {
    expect(migrationDesignDecisions.map((decision) => decision.source)).toEqual(
      expect.arrayContaining(["FRONTEND_IMPLEMENTATION_PLAN.md", "vault_protocol/DESIGN.md"])
    );
    expect(migrationDesignDecisions.map((decision) => decision.reactImplementation).join(" ")).toContain(
      "gateway API client"
    );
  });

  it("keeps status chip contrast accessible in light and dark themes", () => {
    const lightPalette: Record<string, string> = { ...surfaceTokens, ...semanticTokens };
    const darkPalette: Record<string, string> = { ...darkSurfaceTokens, ...darkSemanticTokens };

    for (const definition of Object.values(statusSemantics)) {
      const backgroundToken = classToken(definition.containerClass, "bg-");
      const textToken = classToken(definition.containerClass, "text-");

      if (!backgroundToken || !textToken) {
        throw new Error(`${definition.status} status chip must declare background and text tokens`);
      }

      expect(contrastRatio(lightPalette[textToken], lightPalette[backgroundToken])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkPalette[textToken], darkPalette[backgroundToken])).toBeGreaterThanOrEqual(4.5);
    }
  });
});
