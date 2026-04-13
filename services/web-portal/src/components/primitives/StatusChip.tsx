import type { HTMLAttributes, ReactElement } from "react";
import { statusSemantics, type StatusSemantic } from "../../design-system";
import { cn } from "../../lib/cn";

export interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  status?: StatusSemantic;
}

export const StatusChip = ({
  className,
  status = "neutral",
  ...props
}: StatusChipProps): ReactElement => (
  <span
    className={cn(
      "inline-flex min-h-6 items-center rounded-pill px-3 py-1 text-xs font-black uppercase tracking-wide",
      statusSemantics[status].containerClass,
      className
    )}
    data-status={status}
    {...props}
  />
);
