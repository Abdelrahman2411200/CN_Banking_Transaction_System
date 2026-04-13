import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { StatusChip } from "../../components/primitives";
import type { GatewayHealthState } from "../../lib/api/health";
import { getGatewayHealth } from "../../lib/api/health";

export interface GatewayHealthCardProps {
  initialState?: GatewayHealthState;
  loadHealth?: () => Promise<GatewayHealthState>;
}

const fallbackState: GatewayHealthState = {
  status: "unavailable",
  services: {},
  message: "Gateway health not loaded"
};

const statusToChip = {
  healthy: "success",
  degraded: "warning",
  unavailable: "error"
} as const;

export const GatewayHealthCard = ({
  initialState,
  loadHealth = getGatewayHealth
}: GatewayHealthCardProps): ReactElement => {
  const [health, setHealth] = useState<GatewayHealthState>(initialState ?? fallbackState);

  useEffect(() => {
    let mounted = true;

    if (!initialState) {
      void loadHealth().then((state) => {
        if (mounted) {
          setHealth(state);
        }
      });
    }

    return () => {
      mounted = false;
    };
  }, [initialState, loadHealth]);

  return (
    <article className="grid gap-4 rounded-lg bg-surface-container-lowest p-5" aria-label="Gateway health">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Gateway</p>
          <h3 className="text-lg font-black text-on-surface">Health Probe</h3>
        </div>
        <StatusChip status={statusToChip[health.status]}>{health.status}</StatusChip>
      </div>
      <p className="text-sm text-on-surface-variant">{health.message}</p>
      <dl className="grid gap-2 text-sm">
        {Object.keys(health.services).length > 0 ? (
          Object.entries(health.services).map(([service, status]) => (
            <div className="flex items-center justify-between gap-3" key={service}>
              <dt className="font-bold text-on-surface">{service}</dt>
              <dd className="text-on-surface-variant">{status}</dd>
            </div>
          ))
        ) : (
          <div className="text-on-surface-variant">No service details available.</div>
        )}
      </dl>
    </article>
  );
};
