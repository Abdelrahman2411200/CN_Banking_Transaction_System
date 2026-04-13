import {
  darkSemanticTokens,
  darkSurfaceTokens,
  semanticTokens,
  surfaceTokens
} from "./tokens";

export type ThemeMode = "light" | "dark";

export interface ThemeDefinition {
  mode: ThemeMode;
  rootClass: ThemeMode;
  tokens: Record<string, string>;
}

export const themes: Record<ThemeMode, ThemeDefinition> = {
  light: {
    mode: "light",
    rootClass: "light",
    tokens: { ...surfaceTokens, ...semanticTokens }
  },
  dark: {
    mode: "dark",
    rootClass: "dark",
    tokens: { ...darkSurfaceTokens, ...darkSemanticTokens }
  }
};

export const themeModes = Object.keys(themes) as ThemeMode[];

export const applyTheme = (mode: ThemeMode, root: HTMLElement = document.documentElement): void => {
  root.classList.remove("light", "dark");
  root.classList.add(mode);
};
