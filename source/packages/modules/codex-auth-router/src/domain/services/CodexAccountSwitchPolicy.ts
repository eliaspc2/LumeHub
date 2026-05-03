import type { CodexAccount, CodexAuthRouterState } from '../entities/CodexAuthRouter.js';
import { CodexAccountScorer } from './CodexAccountScorer.js';

export interface CodexAccountSelectionPolicyInput {
  readonly preferredAccountId?: string;
  readonly now: Date;
  readonly ignoreCooldown?: boolean;
}

export class CodexAccountSwitchPolicy {
  constructor(private readonly scorer: CodexAccountScorer = new CodexAccountScorer()) {}

  selectAccount(
    accounts: readonly CodexAccount[],
    _state: CodexAuthRouterState,
    input: CodexAccountSelectionPolicyInput,
  ): CodexAccount | null {
    if (input.preferredAccountId) {
      const preferred = accounts.find((account) => account.accountId === input.preferredAccountId) ?? null;

      if (!preferred || !this.scorer.isAvailable(preferred, input.now, input.ignoreCooldown)) {
        return null;
      }

      return preferred;
    }

    const available = accounts.filter((account) => this.scorer.isAvailable(account, input.now, input.ignoreCooldown));

    if (available.length === 0) {
      return null;
    }

    return [...available].sort(
      (left, right) =>
        scoreRoutingTier(right.routingTier) - scoreRoutingTier(left.routingTier) ||
        right.priority - left.priority ||
        this.scorer.score(right, input.now) - this.scorer.score(left, input.now) ||
        left.label.localeCompare(right.label, 'pt-PT'),
    )[0];
  }
}

function scoreRoutingTier(tier: CodexAccount['routingTier']): number {
  switch (tier) {
    case 'priority':
      return 2;
    case 'reserve':
      return 1;
    case 'do_not_touch':
      return 0;
  }
}
