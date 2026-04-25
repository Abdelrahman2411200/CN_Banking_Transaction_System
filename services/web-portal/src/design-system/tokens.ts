export type TokenSource = "vault_protocol" | "static_export" | "derived";
export type MigrationDecisionSource = "FRONTEND_IMPLEMENTATION_PLAN.md" | "vault_protocol/DESIGN.md";

export interface DesignToken {
  name: string;
  category: "color" | "typography" | "radius" | "spacing" | "shadow" | "border";
  lightValue: string;
  darkValue?: string;
  usage: string;
  source: TokenSource;
}

export interface MigrationDesignDecision {
  principle: string;
  source: MigrationDecisionSource;
  reactImplementation: string;
}

export const surfaceTokens = {
  surface: "#f7f9fb",
  "surface-bright": "#f7f9fb",
  "surface-dim": "#cfdce3",
  "surface-container-lowest": "#ffffff",
  "surface-container-low": "#f0f4f7",
  "surface-container": "#e8eff3",
  "surface-container-high": "#e1e9ee",
  "surface-container-highest": "#d9e4ea",
  "surface-variant": "#d9e4ea",
  "on-surface": "#2a3439",
  "on-surface-variant": "#566166",
  "inverse-surface": "#0b0f10",
  "inverse-on-surface": "#f0f4f7"
} as const;

export const semanticTokens = {
  primary: "#565e74",
  "primary-container": "#dae2fd",
  "on-primary": "#f7f7ff",
  "on-primary-container": "#4a5167",
  secondary: "#526074",
  "secondary-container": "#d5e3fc",
  "on-secondary": "#f8f8ff",
  tertiary: "#006499",
  "tertiary-container": "#51b0f6",
  "on-tertiary-container": "#002d47",
  error: "#9f403d",
  "error-container": "#fe8983",
  "on-error": "#fff7f6",
  "on-error-container": "#752121",
  success: "#18794e",
  "success-container": "#c8f1d8",
  "on-success-container": "#0f5132",
  warning: "#9a6700",
  "warning-container": "#ffe08a",
  "on-warning-container": "#5c3d00",
  info: "#006499",
  "info-container": "#d7ecff",
  "on-info-container": "#003655",
  neutral: "#566166",
  "neutral-container": "#e8eff3",
  "on-neutral-container": "#2a3439",
  outline: "#717c82",
  "outline-variant": "#a9b4b9"
} as const;

export const darkSurfaceTokens = {
  surface: "#0b0f10",
  "surface-bright": "#141a1d",
  "surface-dim": "#090c0d",
  "surface-container-lowest": "#111719",
  "surface-container-low": "#182024",
  "surface-container": "#202a2f",
  "surface-container-high": "#2a3439",
  "surface-container-highest": "#344047",
  "surface-variant": "#3d4a51",
  "on-surface": "#f1f5f7",
  "on-surface-variant": "#c1cbd1",
  "inverse-surface": "#f7f9fb",
  "inverse-on-surface": "#2a3439"
} as const;

export const darkSemanticTokens = {
  primary: "#dbe3ff",
  "primary-container": "#2d354a",
  "on-primary": "#1b2334",
  "on-primary-container": "#e9edff",
  secondary: "#c7d5ed",
  "secondary-container": "#263245",
  "on-secondary": "#111827",
  tertiary: "#7fc7ff",
  "tertiary-container": "#07344f",
  "on-tertiary-container": "#dff2ff",
  error: "#ffb4ae",
  "error-container": "#5b1f1e",
  "on-error": "#3b0808",
  "on-error-container": "#ffdad6",
  success: "#7dd3a8",
  "success-container": "#123e2b",
  "on-success-container": "#d8f7e4",
  warning: "#f7c948",
  "warning-container": "#473300",
  "on-warning-container": "#ffe9a8",
  info: "#7fc7ff",
  "info-container": "#07344f",
  "on-info-container": "#dff2ff",
  neutral: "#c1cbd1",
  "neutral-container": "#253037",
  "on-neutral-container": "#edf2f5",
  outline: "#a9b4b9",
  "outline-variant": "#69777e"
} as const;

export const radiusTokens = {
  sm: "0.125rem",
  md: "0.25rem",
  lg: "0.5rem",
  pill: "9999px"
} as const;

export const typographyTokens = {
  "display-lg": ["3rem", "1.05", "800"],
  "display-md": ["2.25rem", "1.1", "800"],
  "display-sm": ["1.875rem", "1.15", "800"],
  "headline-lg": ["2rem", "1.15", "800"],
  "headline-md": ["1.75rem", "1.2", "800"],
  "headline-sm": ["1.5rem", "1.25", "800"],
  "title-lg": ["1.25rem", "1.3", "700"],
  "title-md": ["1.125rem", "1.35", "700"],
  "title-sm": ["1rem", "1.4", "700"],
  "body-lg": ["1rem", "1.6", "400"],
  "body-md": ["0.875rem", "1.5", "400"],
  "body-sm": ["0.8125rem", "1.45", "400"],
  "label-md": ["0.75rem", "1.4", "700"],
  "label-sm": ["0.6875rem", "1.35", "700"]
} as const;

export const designTokens: DesignToken[] = [
  ...Object.entries(surfaceTokens).map(([name, value]) => ({
    name,
    category: "color" as const,
    lightValue: value,
    darkValue: darkSurfaceTokens[name as keyof typeof darkSurfaceTokens],
    usage: "Surface hierarchy and content foregrounds",
    source: "vault_protocol" as const
  })),
  ...Object.entries(semanticTokens).map(([name, value]) => ({
    name,
    category: "color" as const,
    lightValue: value,
    darkValue: darkSemanticTokens[name as keyof typeof darkSemanticTokens],
    usage: "Semantic interaction and status color",
    source: "vault_protocol" as const
  }))
];

export const migrationDesignDecisions: MigrationDesignDecision[] = [
  {
    principle: "Inter typography remains the only type family for operational screens.",
    source: "vault_protocol/DESIGN.md",
    reactImplementation: "Tailwind font families and typographyTokens"
  },
  {
    principle: "Tonal surface hierarchy replaces decorative divider lines.",
    source: "vault_protocol/DESIGN.md",
    reactImplementation: "surface-container tokens plus PageHeader, ContentGrid, DataTable, and AppShell composition"
  },
  {
    principle: "Semantic colors carry status meaning across light and dark themes.",
    source: "vault_protocol/DESIGN.md",
    reactImplementation: "semanticTokens, darkSemanticTokens, statusSemantics, and StatusChip"
  },
  {
    principle: "Static exports are visual references until parity acceptance, never behavioral source code.",
    source: "FRONTEND_IMPLEMENTATION_PLAN.md",
    reactImplementation: "screenReferences, parityDecisions, and React pages connected through the gateway API client"
  },
  {
    principle: "Browser integrations must terminate at the API gateway boundary.",
    source: "FRONTEND_IMPLEMENTATION_PLAN.md",
    reactImplementation: "Gateway API client in services/web-portal/src/lib/api/client.ts and feature API modules"
  }
];
