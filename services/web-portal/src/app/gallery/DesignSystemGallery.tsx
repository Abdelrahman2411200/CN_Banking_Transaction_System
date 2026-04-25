import type { ReactElement } from "react";
import { useState } from "react";
import { applyTheme, type ThemeMode } from "../../design-system";
import { Button, Input, Select, StatusChip, Toast } from "../../components/primitives";
import { AccountShellReference } from "./AccountShellReference";
import { GatewayHealthCard } from "./GatewayHealthCard";
import { parityDecisions } from "./parityDecisions";
import { canonicalScreenReferences, screenFamilyVariantChoices } from "./screenReferences";

export const DesignSystemGallery = (): ReactElement => {
  const [theme, setTheme] = useState<ThemeMode>("light");

  const nextTheme: ThemeMode = theme === "light" ? "dark" : "light";

  const toggleTheme = (): void => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <div className="grid gap-10">
      <section className="mx-auto grid w-full max-w-6xl gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-2">
            <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
              Sovereign Ledger
            </p>
            <h1 className="text-3xl font-black tracking-normal text-on-surface">Design System Gallery</h1>
            <p className="max-w-2xl text-sm leading-6 text-on-surface-variant">
              Manual parity target for static export migration into gateway-backed React screens.
            </p>
          </div>
          <Button onClick={toggleTheme} variant="secondary">
            Use {nextTheme} mode
          </Button>
        </div>
        <section className="grid gap-4 rounded-lg bg-surface-container-low p-4 md:grid-cols-[1fr_1fr]">
          <div className="grid gap-4 rounded-lg bg-surface-container-lowest p-5">
            <StatusChip status="info">authentication</StatusChip>
            <h2 className="text-2xl font-black text-on-surface">Sovereign Ledger</h2>
            <p className="text-sm text-on-surface-variant">Architectural precision in cloud-native banking.</p>
            <Input label="Email" placeholder="operator@cn-banking.local" type="email" />
            <Input label="Password" placeholder="Enter password" type="password" />
            <Select label="Session Role">
              <option>Operator</option>
              <option>Admin</option>
            </Select>
            <Button>Access Portal</Button>
            <Toast message="Too many attempts. Please wait before retrying." status="warning" title="Security threshold" />
          </div>
          <GatewayHealthCard />
        </section>
        <section className="grid gap-3 rounded-lg bg-surface-container-low p-4">
          <h2 className="text-xl font-black text-on-surface">Canonical References</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {canonicalScreenReferences.map((reference) => (
              <article className="rounded-lg bg-surface-container-lowest p-4" key={reference.folder}>
                <StatusChip status={reference.theme === "dark" ? "neutral" : "info"}>{reference.theme}</StatusChip>
                <h3 className="mt-3 text-lg font-black text-on-surface">{reference.folder}</h3>
                <p className="mt-2 text-sm text-on-surface-variant">{reference.patternsUsed.join(", ")}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="grid gap-3 rounded-lg bg-surface-container-low p-4">
          <h2 className="text-xl font-black text-on-surface">Phase 16 Variant Choices</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {screenFamilyVariantChoices.map((choice) => (
              <article className="rounded-lg bg-surface-container-lowest p-4" key={choice.screenFamily}>
                <StatusChip status="info">{choice.screenFamily}</StatusChip>
                <h3 className="mt-3 text-lg font-black text-on-surface">{choice.selectedVariant}</h3>
                <p className="mt-2 text-sm text-on-surface-variant">{choice.routeScope}</p>
                <p className="mt-2 text-sm text-on-surface-variant">{choice.rationale}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="grid gap-3 rounded-lg bg-surface-container-low p-4">
          <h2 className="text-xl font-black text-on-surface">Parity Decisions</h2>
          {parityDecisions.map((decision) => (
            <article className="rounded-lg bg-surface-container-lowest p-4" key={`${decision.reference}-${decision.pattern}`}>
              <StatusChip status={decision.decision === "accept" ? "success" : decision.decision === "reject" ? "error" : "warning"}>
                {decision.decision}
              </StatusChip>
              <h3 className="mt-3 font-black text-on-surface">{decision.pattern}</h3>
              <p className="mt-2 text-sm text-on-surface-variant">{decision.reason}</p>
            </article>
          ))}
        </section>
      </section>
      <AccountShellReference />
    </div>
  );
};
