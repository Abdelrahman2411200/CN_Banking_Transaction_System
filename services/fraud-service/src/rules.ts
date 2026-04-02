export interface RuleResult {
  ruleTriggered: 'large_transfer' | 'velocity_check' | 'round_number' | 'rapid_drain';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export const evaluateLargeTransfer = (amount: number): RuleResult | null =>
  amount > 10000
    ? { ruleTriggered: 'large_transfer', severity: 'high' }
    : null;

export const evaluateVelocityCheck = (recentTransferCount: number): RuleResult | null =>
  recentTransferCount > 5
    ? { ruleTriggered: 'velocity_check', severity: 'medium' }
    : null;

export const evaluateRoundNumber = (amount: number): RuleResult | null =>
  amount >= 1000 && amount % 1000 === 0
    ? { ruleTriggered: 'round_number', severity: 'low' }
    : null;

export const evaluateRapidDrain = (recentOutgoingTotal: number, currentBalance: number): RuleResult | null =>
  currentBalance > 0 && recentOutgoingTotal > currentBalance * 0.8
    ? { ruleTriggered: 'rapid_drain', severity: 'critical' }
    : null;
