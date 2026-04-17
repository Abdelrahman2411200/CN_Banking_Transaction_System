import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { StatusChip } from "./StatusChip";

export interface MetricCardProps extends HTMLAttributes<HTMLElement> {
  label: string;
  value: string;
  delta?: string;
  icon?: ReactNode;
  status?: "success" | "warning" | "error" | "info" | "neutral" | "unknown";
}

export const MetricCard = ({
  className,
  delta,
  icon,
  label,
  status,
  value,
  ...props
}: MetricCardProps): ReactElement => (
  <article
    className={cn("grid min-h-32 min-w-0 gap-4 rounded-lg bg-surface-container-lowest p-5", className)}
    {...props}
  >
    <div className="flex min-w-0 items-start justify-between gap-3">
      <p className="min-w-0 break-words text-xs font-black uppercase tracking-widest text-on-surface-variant">{label}</p>
      {icon ? <span className="shrink-0 text-tertiary">{icon}</span> : null}
    </div>
    <p className="min-w-0 break-all text-3xl font-black tracking-normal text-on-surface">{value}</p>
    {status || delta ? (
      <div>{status ? <StatusChip status={status}>{delta ?? status}</StatusChip> : delta}</div>
    ) : null}
  </article>
);
