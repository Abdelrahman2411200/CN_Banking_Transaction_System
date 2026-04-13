import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface PageHeaderProps extends HTMLAttributes<HTMLElement> {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export const PageHeader = ({
  actions,
  className,
  description,
  eyebrow,
  title,
  ...props
}: PageHeaderProps): ReactElement => (
  <section className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)} {...props}>
    <div className="grid min-w-0 gap-2">
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">{eyebrow}</p>
      ) : null}
      <h2 className="text-3xl font-black tracking-normal text-on-surface">{title}</h2>
      {description ? <p className="max-w-3xl text-sm leading-6 text-on-surface-variant">{description}</p> : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
  </section>
);

export type ContentGridProps = HTMLAttributes<HTMLDivElement>;

export const ContentGrid = ({ className, ...props }: ContentGridProps): ReactElement => (
  <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-4", className)} {...props} />
);
