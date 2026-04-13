import type { HTMLAttributes, ReactElement } from "react";
import { cn } from "../../lib/cn";
import { StatusChip } from "./StatusChip";

export interface EmptyStateProps extends HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
  tone?: "neutral" | "error";
}

export const EmptyState = ({
  className,
  description,
  title,
  tone = "neutral",
  ...props
}: EmptyStateProps): ReactElement => (
  <section
    className={cn("grid min-h-40 place-items-center rounded-lg bg-surface-container-lowest p-6 text-center", className)}
    {...props}
  >
    <div className="grid gap-2">
      <StatusChip status={tone === "error" ? "error" : "neutral"}>{tone}</StatusChip>
      <h3 className="text-lg font-black text-on-surface">{title}</h3>
      {description ? <p className="text-sm text-on-surface-variant">{description}</p> : null}
    </div>
  </section>
);

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export const Skeleton = ({ className, ...props }: SkeletonProps): ReactElement => (
  <div
    className={cn("animate-pulse rounded-lg bg-surface-container-high", className)}
    role="status"
    {...props}
  />
);
