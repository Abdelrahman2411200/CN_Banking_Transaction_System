import {
  evaluateLargeTransfer,
  evaluateRapidDrain,
  evaluateRoundNumber,
  evaluateVelocityCheck,
} from '../rules';

describe('fraud rules', () => {
  describe('large_transfer', () => {
    it('fires only when amount is above 10000', () => {
      expect(evaluateLargeTransfer(10000)).toBeNull();
      expect(evaluateLargeTransfer(10000.01)).toEqual({
        ruleTriggered: 'large_transfer',
        severity: 'high',
      });
    });
  });

  describe('velocity_check', () => {
    it('fires only when more than five transfers occurred in the last hour', () => {
      expect(evaluateVelocityCheck(5)).toBeNull();
      expect(evaluateVelocityCheck(6)).toEqual({
        ruleTriggered: 'velocity_check',
        severity: 'medium',
      });
    });
  });

  describe('round_number', () => {
    it('fires for exact positive thousands only', () => {
      expect(evaluateRoundNumber(999)).toBeNull();
      expect(evaluateRoundNumber(5000)).toEqual({
        ruleTriggered: 'round_number',
        severity: 'low',
      });
      expect(evaluateRoundNumber(5500)).toBeNull();
    });
  });

  describe('rapid_drain', () => {
    it('fires when outgoing volume exceeds 80 percent of balance', () => {
      expect(evaluateRapidDrain(800, 1000)).toBeNull();
      expect(evaluateRapidDrain(801, 1000)).toEqual({
        ruleTriggered: 'rapid_drain',
        severity: 'critical',
      });
    });
  });
});
