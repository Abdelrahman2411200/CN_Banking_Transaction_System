import type { HTMLAttributes, ReactElement } from "react";
import type { StatusSemantic } from "../../design-system";
import { cn } from "../../lib/cn";
import { StatusChip } from "./StatusChip";

export interface ToastProps extends HTMLAttributes<HTMLElement> {
  title: string;
  message?: string;
  status?: StatusSemantic;
}

export const Toast = ({
  className,
  message,
  status = "info",
  title,
  ...props
}: ToastProps): ReactElement => (
  <aside
    aria-live={status === "error" ? "assertive" : "polite"}
    className={cn("max-w-sm rounded-lg bg-surface-container-lowest p-4 shadow-ambient", className)}
    {...props}
  >
    <div className="grid gap-2">
      <StatusChip status={status}>{status}</StatusChip>
      <p className="font-bold text-on-surface">{title}</p>
      {message ? <p className="text-sm text-on-surface-variant">{message}</p> : null}
    </div>
  </aside>
);
