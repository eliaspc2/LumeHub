import type { CodexAccount, CodexAuthRouterState } from '../entities/CodexAuthRouter.js';

export class CodexAccountScorer {
  score(account: CodexAccount, state: CodexAuthRouterState, now: Date): number {
    if (!account.exists) {
      return Number.NEGATIVE_INFINITY;
    }

    const cooldownUntil = account.usage.cooldownUntil ? Date.parse(account.usage.cooldownUntil) : null;
    const inCooldown = cooldownUntil !== null && cooldownUntil > now.getTime();
    const currentBonus = state.currentSelection?.accountId === account.accountId ? 12 : 0;
    const reliabilityScore = account.usage.successCount * 3 - account.usage.failureCount * 5 - account.usage.consecutiveFailures * 8;
    const priorityScore = Math.max(0, 20 - account.priority * 2);
    const kindBonus = account.kind === 'secondary' ? 6 : 0;
    const cooldownPenalty = inCooldown ? 1_000 : 0;

    return currentBonus + reliabilityScore + priorityScore + kindBonus - cooldownPenalty;
  }

  isAvailable(account: CodexAccount, now: Date, ignoreCooldown = false): boolean {
    if (!account.exists) {
      return false;
    }

    if (ignoreCooldown) {
      return true;
    }

    if (!account.usage.cooldownUntil) {
      return true;
    }

    return Date.parse(account.usage.cooldownUntil) <= now.getTime();
  }
}
