import type { HTMLAttributes, ReactElement } from "react";
import { cn } from "../../lib/cn";
import type { NavItem } from "./Sidebar";

export interface MobileNavProps extends HTMLAttributes<HTMLElement> {
  items: NavItem[];
}

export const MobileNav = ({ className, items, ...props }: MobileNavProps): ReactElement => (
  <nav
    aria-label="Mobile navigation"
    className={cn(
      "grid grid-cols-4 gap-1 bg-surface-container-low p-2 shadow-[0_-12px_30px_rgb(42_52_57_/_0.06)] lg:hidden",
      className
    )}
    {...props}
  >
    {items.slice(0, 4).map((item) => (
      <a
        className={cn(
          "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-2 text-center text-[11px] font-black text-on-surface-variant",
          item.active && "bg-primary-container text-on-primary-container"
        )}
        href={item.href}
        key={item.href}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-xl">
          {item.icon}
        </span>
        <span className="max-w-full truncate">{item.label}</span>
      </a>
    ))}
  </nav>
);
