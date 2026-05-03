import type { CodexAccount, CodexRoutingTier } from '../entities/CodexAuthRouter.js';

export class CodexAccountScorer {
  score(account: CodexAccount, now: Date): number {
    if (!account.exists) {
      return Number.NEGATIVE_INFINITY;
    }

    if (account.routingTier === 'do_not_touch') {
      return Number.NEGATIVE_INFINITY;
    }

    const cooldownUntil = account.usage.cooldownUntil ? Date.parse(account.usage.cooldownUntil) : null;
    const inCooldown = cooldownUntil !== null && cooldownUntil > now.getTime();
    const reliabilityScore = account.usage.successCount * 3 - account.usage.failureCount * 5 - account.usage.consecutiveFailures * 8;
    const kindBonus = account.kind === 'secondary' ? 6 : 0;
    const cooldownPenalty = inCooldown ? 1_000 : 0;
    const globalRateScore = scoreGlobalRate(account);

    return reliabilityScore + kindBonus + globalRateScore - cooldownPenalty;
  }

  isAvailable(account: CodexAccount, now: Date, ignoreCooldown = false): boolean {
    if (!account.exists) {
      return false;
    }

    if (account.routingTier === 'do_not_touch') {
      return false;
    }

    if (ignoreCooldown) {
      return true;
    }

    if (!account.usage.cooldownUntil) {
      return isQuotaAvailable(account);
    }

    return Date.parse(account.usage.cooldownUntil) <= now.getTime() && isQuotaAvailable(account);
  }
}

function scoreQuota(account: CodexAccount): number {
  const quota = account.quota;

  if (!quota) {
    return 0;
  }

  if (quota.fetchError) {
    return -15;
  }

  const primaryRemaining = quota.primaryWindow?.remainingPercent;
  const secondaryRemaining = quota.secondaryWindow?.remainingPercent;
  const remaining =
    primaryRemaining !== null && primaryRemaining !== undefined
      ? primaryRemaining * 0.65 + (secondaryRemaining ?? primaryRemaining) * 0.35
      : 0;
  const creditBonus = quota.credits.unlimited ? 30 : quota.credits.hasCredits ? 12 : 0;
  const limitPenalty = !quota.allowed || quota.limitReached ? 1_000 : 0;

  return remaining + creditBonus - limitPenalty;
}

function scoreGlobalRate(account: CodexAccount): number {
  const quotaScore = scoreQuota(account);
  const usageScore = account.usage.successCount - account.usage.failureCount * 2 - account.usage.consecutiveFailures * 4;

  return quotaScore + usageScore;
}

function isQuotaAvailable(account: CodexAccount): boolean {
  const quota = account.quota;

  if (!quota || quota.fetchError) {
    return true;
  }

  return quota.allowed && !quota.limitReached;
}
