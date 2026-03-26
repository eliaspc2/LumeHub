import { randomUUID } from 'node:crypto';

import { SystemClock, type Clock } from '@lume-hub/clock';

import type { PowerDemandReason } from '../../domain/entities/PowerDemandReason.js';
import type { PowerInhibitLease } from '../../domain/entities/PowerInhibitLease.js';
import type { PowerPolicy, PowerPolicyUpdate } from '../../domain/entities/PowerPolicy.js';
import type { PowerStatus } from '../../domain/entities/PowerStatus.js';
import { PowerPolicyEvaluator } from '../../domain/services/PowerPolicyEvaluator.js';
import { PowerPolicyRepository } from '../../infrastructure/persistence/PowerPolicyRepository.js';
import { SleepInhibitorAdapter } from '../../infrastructure/system/SleepInhibitorAdapter.js';

export interface AcquireInhibitorInput {
  readonly now?: Date;
  readonly reasons?: readonly PowerDemandReason[];
  readonly explanation?: string;
}

export interface EvaluatePowerPolicyInput {
  readonly now?: Date;
  readonly activeReasons?: readonly PowerDemandReason[];
}

export class SystemPowerService {
  constructor(
    private readonly repository: PowerPolicyRepository,
    private readonly adapter: SleepInhibitorAdapter,
    private readonly evaluator = new PowerPolicyEvaluator(),
    private readonly clock: Clock = new SystemClock(),
  ) {}

  async evaluatePowerPolicy(input: EvaluatePowerPolicyInput = {}): Promise<PowerStatus> {
    const now = input.now ?? this.clock.now();
    const state = await this.repository.readState(now);
    const evaluation = this.evaluator.evaluate(state.policy, input.activeReasons ?? [], state.activeLease);

    if (evaluation.desiredState === 'inhibited') {
      return this.acquireInhibitor({
        now,
        reasons: evaluation.reasons,
        explanation: evaluation.explanation,
      });
    }

    if (state.activeLease) {
      await this.releaseInhibitor({
        now,
      });
    }

    return this.getPowerStatus(now);
  }

  async acquireInhibitor(input: AcquireInhibitorInput = {}): Promise<PowerStatus> {
    const now = input.now ?? this.clock.now();
    const state = await this.repository.readState(now);
    const reasons = input.reasons ?? state.policy.preferredReasons;
    const explanation = input.explanation ?? `Power inhibitor requested by: ${reasons.join(', ') || 'manual override'}.`;
    const currentLease = state.activeLease;

    if (
      currentLease &&
      currentLease.releasedAt === null &&
      sameStringArray(currentLease.reasons, reasons) &&
      currentLease.explanation === explanation
    ) {
      await this.adapter.acquire(currentLease);
      return this.toPowerStatus(state.policy, currentLease, explanation, reasons, now);
    }

    const nextLease: PowerInhibitLease = {
      leaseId: `power-lease-${randomUUID()}`,
      reasons,
      explanation,
      acquiredAt: now.toISOString(),
      releasedAt: null,
    };

    await this.adapter.acquire(nextLease);
    await this.repository.saveLease(nextLease, now);

    return this.toPowerStatus(state.policy, nextLease, explanation, reasons, now);
  }

  async releaseInhibitor(input: { readonly now?: Date } = {}): Promise<PowerInhibitLease | undefined> {
    const now = input.now ?? this.clock.now();
    const state = await this.repository.readState(now);

    if (!state.activeLease) {
      await this.adapter.release();
      return undefined;
    }

    const releasedLease: PowerInhibitLease = {
      ...state.activeLease,
      releasedAt: now.toISOString(),
    };

    await this.adapter.release();
    await this.repository.saveLease(null, now);
    return releasedLease;
  }

  async getPowerStatus(now = this.clock.now()): Promise<PowerStatus> {
    const state = await this.repository.readState(now);
    const inhibitorActive = await this.adapter.isActive();

    return this.toPowerStatus(
      state.policy,
      state.activeLease,
      state.activeLease?.explanation ?? 'No active demand requires an inhibitor.',
      state.activeLease?.reasons ?? [],
      now,
      inhibitorActive,
    );
  }

  async updatePowerPolicy(update: PowerPolicyUpdate, now = this.clock.now()): Promise<PowerPolicy> {
    const state = await this.repository.readState(now);
    const nextPolicy: PowerPolicy = {
      ...state.policy,
      ...update,
      preferredReasons: update.preferredReasons ?? state.policy.preferredReasons,
      updatedAt: now.toISOString(),
    };

    await this.repository.savePolicy(nextPolicy, now);
    return nextPolicy;
  }

  private toPowerStatus(
    policy: PowerPolicy,
    activeLease: PowerInhibitLease | null,
    explanation: string,
    reasons: readonly PowerDemandReason[],
    now: Date,
    inhibitorActive = activeLease !== null,
  ): PowerStatus {
    return {
      policy,
      activeLease,
      desiredState: activeLease ? 'inhibited' : 'released',
      inhibitorActive,
      inhibitorStatePath: this.adapter.getInhibitorStatePath(),
      reasons,
      explanation,
      updatedAt: now.toISOString(),
    };
  }
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
