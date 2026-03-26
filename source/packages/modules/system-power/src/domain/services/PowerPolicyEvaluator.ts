import type { PowerDemandReason } from '../entities/PowerDemandReason.js';
import type { PowerInhibitLease } from '../entities/PowerInhibitLease.js';
import type { PowerPolicy } from '../entities/PowerPolicy.js';

export interface PowerPolicyEvaluation {
  readonly desiredState: 'inhibited' | 'released';
  readonly reasons: readonly PowerDemandReason[];
  readonly explanation: string;
}

export class PowerPolicyEvaluator {
  evaluate(
    policy: PowerPolicy,
    activeReasons: readonly PowerDemandReason[],
    activeLease?: PowerInhibitLease | null,
  ): PowerPolicyEvaluation {
    if (!policy.enabled) {
      return {
        desiredState: 'released',
        reasons: [],
        explanation: 'Power policy is disabled.',
      };
    }

    if (policy.mode === 'allow_sleep') {
      return {
        desiredState: 'released',
        reasons: [],
        explanation: 'Power policy explicitly allows sleep.',
      };
    }

    if (policy.mode === 'always_inhibit') {
      const reasons: readonly PowerDemandReason[] =
        policy.preferredReasons.length > 0 ? policy.preferredReasons : ['host_companion'];

      return {
        desiredState: 'inhibited',
        reasons,
        explanation: `Power policy requests a persistent inhibitor (${reasons.join(', ')}).`,
      };
    }

    if (activeReasons.length > 0) {
      return {
        desiredState: 'inhibited',
        reasons: activeReasons,
        explanation: `Power inhibitor required because of active demand: ${activeReasons.join(', ')}.`,
      };
    }

    if (activeLease && activeLease.releasedAt === null) {
      return {
        desiredState: 'released',
        reasons: [],
        explanation: 'No active operational demand remains, so the inhibitor can be released.',
      };
    }

    return {
      desiredState: 'released',
      reasons: [],
      explanation: 'No active demand requires an inhibitor.',
    };
  }
}
