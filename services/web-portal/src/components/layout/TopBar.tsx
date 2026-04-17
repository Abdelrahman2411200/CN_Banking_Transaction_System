import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface TopBarProps extends HTMLAttributes<HTMLElement> {
  title: string;
  actions?: ReactNode;
}

export const TopBar = ({ actions, className, title, ...props }: TopBarProps): ReactElement => (
  <header
    className={cn("flex min-h-16 flex-wrap items-center justify-between gap-4 bg-surface-bright px-4 py-3", className)}
    {...props}
  >
    <h1 className="min-w-0 break-words text-xl font-black tracking-normal text-on-surface">{title}</h1>
    {actions ? <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </header>
);
