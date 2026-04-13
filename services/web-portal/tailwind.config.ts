import type { Config } from "tailwindcss";
import { typographyTokens } from "./src/design-system/tokens";

const cssColor = (name: string): string => `rgb(var(--tw-${name}) / <alpha-value>)`;
const varColor = (name: string): string => `var(--color-${name})`;
const tailwindFontSize = Object.fromEntries(
  Object.entries(typographyTokens).map(([name, [fontSize, lineHeight, fontWeight]]) => [
    name,
    [fontSize, { lineHeight, fontWeight }]
  ])
) as Record<string, [string, { lineHeight: string; fontWeight: string }]>;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: varColor("surface"),
        "surface-bright": varColor("surface-bright"),
        "surface-dim": varColor("surface-dim"),
        "surface-container-lowest": varColor("surface-container-lowest"),
        "surface-container-low": varColor("surface-container-low"),
        "surface-container": varColor("surface-container"),
        "surface-container-high": varColor("surface-container-high"),
        "surface-container-highest": varColor("surface-container-highest"),
        "surface-variant": varColor("surface-variant"),
        "on-surface": varColor("on-surface"),
        "on-surface-variant": varColor("on-surface-variant"),
        primary: varColor("primary"),
        "primary-container": varColor("primary-container"),
        "on-primary": varColor("on-primary"),
        "on-primary-container": varColor("on-primary-container"),
        secondary: varColor("secondary"),
        "secondary-container": varColor("secondary-container"),
        "on-secondary": varColor("on-secondary"),
        tertiary: varColor("tertiary"),
        "tertiary-container": varColor("tertiary-container"),
        "on-tertiary-container": varColor("on-tertiary-container"),
        error: varColor("error"),
        "error-container": varColor("error-container"),
        "on-error": varColor("on-error"),
        "on-error-container": varColor("on-error-container"),
        success: varColor("success"),
        "success-container": varColor("success-container"),
        "on-success-container": varColor("on-success-container"),
        warning: varColor("warning"),
        "warning-container": varColor("warning-container"),
        "on-warning-container": varColor("on-warning-container"),
        info: varColor("info"),
        "info-container": varColor("info-container"),
        "on-info-container": varColor("on-info-container"),
        neutral: varColor("neutral"),
        "neutral-container": varColor("neutral-container"),
        "on-neutral-container": varColor("on-neutral-container"),
        outline: varColor("outline"),
        "outline-variant": varColor("outline-variant"),
        "focus-ring": cssColor("focus-ring")
      },
      borderRadius: {
        sm: "0.125rem",
        md: "0.25rem",
        lg: "0.5rem",
        pill: "9999px"
      },
      fontFamily: {
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        label: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      fontSize: tailwindFontSize,
      boxShadow: {
        ambient: "0 20px 40px rgb(42 52 57 / 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
