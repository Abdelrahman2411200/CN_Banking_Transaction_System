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
    <div className="flex min-h-screen">
      <Sidebar items={navItems} />
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <TopBar actions={actions} title={title} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
    <MobileNav items={navItems} />
  </div>
);
