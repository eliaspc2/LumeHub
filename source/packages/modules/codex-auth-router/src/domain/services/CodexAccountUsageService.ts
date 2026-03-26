import type {
  CodexAccountState,
  CodexFailureKind,
  CodexAuthRouterState,
} from '../entities/CodexAuthRouter.js';
import { DEFAULT_CODEX_ACCOUNT_STATE } from '../entities/CodexAuthRouter.js';

export class CodexAccountUsageService {
  recordSuccess(state: CodexAuthRouterState, accountId: string, now: Date): CodexAuthRouterState {
    const current = ensureAccountState(state.accountStates[accountId]);
    const nextState: CodexAccountState = {
      ...current,
      successCount: current.successCount + 1,
      consecutiveFailures: 0,
      lastSuccessAt: now.toISOString(),
      cooldownUntil: null,
      lastFailureReason: null,
      lastFailureKind: null,
    };

    return {
      ...state,
      accountStates: {
        ...state.accountStates,
        [accountId]: nextState,
      },
      updatedAt: now.toISOString(),
      lastError: null,
    };
  }

  recordFailure(
    state: CodexAuthRouterState,
    accountId: string,
    reason: string,
    failureKind: CodexFailureKind,
    now: Date,
  ): CodexAuthRouterState {
    const current = ensureAccountState(state.accountStates[accountId]);
    const nextState: CodexAccountState = {
      ...current,
      failureCount: current.failureCount + 1,
      consecutiveFailures: current.consecutiveFailures + 1,
      lastFailureAt: now.toISOString(),
      lastFailureKind: failureKind,
      lastFailureReason: reason,
      cooldownUntil: new Date(now.getTime() + cooldownForFailure(failureKind)).toISOString(),
    };

    return {
      ...state,
      accountStates: {
        ...state.accountStates,
        [accountId]: nextState,
      },
      updatedAt: now.toISOString(),
      lastError: reason,
    };
  }
}

function cooldownForFailure(failureKind: CodexFailureKind): number {
  switch (failureKind) {
    case 'quota':
      return 15 * 60_000;
    case 'auth':
      return 10 * 60_000;
    case 'network':
      return 60_000;
    default:
      return 3 * 60_000;
  }
}

function ensureAccountState(state: CodexAccountState | undefined): CodexAccountState {
  return {
    ...DEFAULT_CODEX_ACCOUNT_STATE,
    ...(state ?? {}),
  };
}
