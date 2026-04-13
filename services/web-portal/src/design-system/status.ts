export type StatusSemantic = "success" | "warning" | "error" | "info" | "neutral" | "unknown";

export interface StatusDefinition {
  status: StatusSemantic;
  containerClass: string;
  textClass: string;
  meaning: string;
}

export const statusSemantics: Record<StatusSemantic, StatusDefinition> = {
  success: {
    status: "success",
    containerClass: "bg-success-container text-on-success-container",
    textClass: "text-on-success-container",
    meaning: "Completed or healthy state"
  },
  warning: {
    status: "warning",
    containerClass: "bg-warning-container text-on-warning-container",
    textClass: "text-on-warning-container",
    meaning: "Pending approval or risk flag"
  },
  error: {
    status: "error",
    containerClass: "bg-error-container text-on-error-container",
    textClass: "text-on-error-container",
    meaning: "Failed validation or critical alert"
  },
  info: {
    status: "info",
    containerClass: "bg-info-container text-on-info-container",
    textClass: "text-on-info-container",
    meaning: "Neutral system notification or data link"
  },
  neutral: {
    status: "neutral",
    containerClass: "bg-neutral-container text-on-neutral-container",
    textClass: "text-on-neutral-container",
    meaning: "General metadata"
  },
  unknown: {
    status: "unknown",
    containerClass: "bg-surface-container-high text-on-surface",
    textClass: "text-on-surface",
    meaning: "Fallback status without success implication"
  }
};
