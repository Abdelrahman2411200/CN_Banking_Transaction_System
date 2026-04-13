import type { ReactElement } from "react";
import { Button, Input, MetricCard, StatusChip } from "../../components/primitives";
import { AppShell, ContentGrid, PageHeader, type NavItem } from "../../components/layout";

const navItems: NavItem[] = [
  { href: "#dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "#accounts", icon: "account_balance", label: "Accounts", active: true },
  { href: "#transfers", icon: "swap_horiz", label: "Transfers" },
  { href: "#ledger", icon: "menu_book", label: "Ledger" }
];

export const AccountShellReference = (): ReactElement => (
  <AppShell
    actions={<StatusChip status="info">reference</StatusChip>}
    navItems={navItems}
    title="Banking Ops"
  >
    <div className="grid gap-6">
      <PageHeader
        actions={<Button>Create Account</Button>}
        description="A compact account management shell rebuilt from shared primitives."
        eyebrow="Account Management"
        title="Account Ecosystem"
      />
      <ContentGrid>
        <MetricCard label="Verified accounts" status="success" value="1,284" />
        <MetricCard label="Pending KYC" status="warning" value="24" />
        <MetricCard label="Frozen accounts" status="error" value="3" />
        <MetricCard label="Average balance" status="info" value="$48,210" />
      </ContentGrid>
      <section className="grid gap-4 rounded-lg bg-surface-container-low p-4 md:grid-cols-[1fr_1.4fr]">
        <form className="grid gap-4 rounded-lg bg-surface-container-lowest p-5">
          <h3 className="text-lg font-black text-on-surface">Create Account</h3>
          <Input label="Customer Name" placeholder="Evelyn Rothschild" />
          <Input label="Email" placeholder="evelyn@example.com" type="email" />
          <Button>Save Draft</Button>
        </form>
        <article className="grid content-start gap-3 rounded-lg bg-surface-container-lowest p-5">
          <StatusChip status="success">verified</StatusChip>
          <h3 className="text-2xl font-black text-on-surface">Evelyn Rothschild</h3>
          <p className="text-sm text-on-surface-variant">Account profile panel for the canonical account reference.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary">Review KYC</Button>
            <Button variant="danger">Freeze</Button>
          </div>
        </article>
      </section>
    </div>
  </AppShell>
);
