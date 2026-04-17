import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { cn } from "../../lib/cn";

export interface NavItem {
  label: string;
  icon: string;
  href: string;
  active?: boolean;
}

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  items: NavItem[];
  productName?: string;
}

export interface NavItemLinkProps {
  children: ReactNode;
  className?: string;
  item: NavItem;
}

export const NavItemLink = ({ children, className, item }: NavItemLinkProps): ReactElement => {
  const inRouter = useInRouterContext();
  const ariaCurrent = item.active ? "page" : undefined;

  if (inRouter && item.href.startsWith("/")) {
    return (
      <Link aria-current={ariaCurrent} className={className} to={item.href}>
        {children}
      </Link>
    );
  }

  return (
    <a aria-current={ariaCurrent} className={className} href={item.href}>
      {children}
    </a>
  );
};

export const Sidebar = ({
  className,
  items,
  productName = "Banking Ops",
  ...props
}: SidebarProps): ReactElement => (
  <aside className={cn("hidden min-h-screen w-64 shrink-0 bg-surface-container-low p-4 lg:block", className)} {...props}>
    <div className="mb-8 px-2">
      <p className="text-xl font-black tracking-normal text-on-surface">{productName}</p>
      <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
        Production Environment
      </p>
    </div>
    <nav aria-label="Primary navigation" className="grid gap-1">
      {items.map((item) => (
        <NavItemLink
          className={cn(
            "flex min-h-10 min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface",
            item.active &&
              "border-l-4 border-primary bg-primary-container pl-2 text-on-primary-container"
          )}
          item={item}
          key={item.href}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-lg">
            {item.icon}
          </span>
          <span className="min-w-0 break-words">{item.label}</span>
        </NavItemLink>
      ))}
    </nav>
  </aside>
);
