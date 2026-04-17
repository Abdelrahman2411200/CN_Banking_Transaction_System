import type { ReactElement, ReactNode } from "react";
import { MobileNav } from "./MobileNav";
import { Sidebar, type NavItem } from "./Sidebar";
import { TopBar } from "./TopBar";

export interface AppShellProps {
  children: ReactNode;
  navItems: NavItem[];
  title: string;
  actions?: ReactNode;
}

export const AppShell = ({ actions, children, navItems, title }: AppShellProps): ReactElement => (
  <div className="min-h-screen bg-surface text-on-surface">
    <a className="skip-link" href="#portal-main">
      Skip to workspace
    </a>
    <div className="flex min-h-screen">
      <Sidebar items={navItems} />
      <div className="flex min-w-0 flex-1 flex-col pb-36 sm:pb-24 lg:pb-0">
        <TopBar actions={actions} title={title} />
        <main aria-label="Portal workspace" className="min-w-0 flex-1 p-4 md:p-6" id="portal-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
    <MobileNav items={navItems} />
  </div>
);
