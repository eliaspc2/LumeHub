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
    state: CodexAuthRouterState,
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
        this.scorer.score(right, state, input.now) - this.scorer.score(left, state, input.now) ||
        left.priority - right.priority ||
        left.label.localeCompare(right.label),
    )[0];
  }
}
