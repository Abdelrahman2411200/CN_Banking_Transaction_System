import { describe, expect, it } from "vitest";
import { applyTheme, themes } from "./theme";

describe("theme", () => {
  it("provides shared light and dark token maps", () => {
    expect(themes.light.tokens.surface).toBe("#f7f9fb");
    expect(themes.dark.tokens.surface).toBe("#0b0f10");
  });

  it("applies the root theme class without creating separate components", () => {
    const root = document.createElement("html");
    root.className = "light";

    applyTheme("dark", root);

    expect(root).toHaveClass("dark");
    expect(root).not.toHaveClass("light");
  });
});
