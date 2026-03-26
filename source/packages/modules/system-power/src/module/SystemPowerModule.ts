import { resolve } from 'node:path';

import { SystemClock } from '@lume-hub/clock';
import { BaseModule } from '@lume-hub/kernel';

import { SystemPowerService } from '../application/services/SystemPowerService.js';
import type { PowerPolicyUpdate } from '../domain/entities/PowerPolicy.js';
import { PowerPolicyEvaluator } from '../domain/services/PowerPolicyEvaluator.js';
import { PowerPolicyRepository } from '../infrastructure/persistence/PowerPolicyRepository.js';
import { SleepInhibitorAdapter } from '../infrastructure/system/SleepInhibitorAdapter.js';
import type { SystemPowerModuleContract } from '../public/contracts/index.js';
import type { SystemPowerModuleConfig } from './SystemPowerModuleConfig.js';

export class SystemPowerModule extends BaseModule implements SystemPowerModuleContract {
  readonly moduleName = 'system-power' as const;
  readonly service: SystemPowerService;

  constructor(readonly config: SystemPowerModuleConfig = {}) {
    super({
      name: 'system-power',
      version: '0.1.0',
      dependencies: [],
    });

    const clock = config.clock ?? new SystemClock();
    const repository =
      config.repository ??
      new PowerPolicyRepository({
        stateFilePath: config.stateFilePath ?? resolve(process.cwd(), 'runtime/host/state/power-policy-state.json'),
      });
    const adapter =
      config.adapter ??
      new SleepInhibitorAdapter({
        inhibitorStatePath:
          config.inhibitorStatePath ?? resolve(process.cwd(), 'runtime/host/state/sleep-inhibitor.json'),
      });

    this.service =
      config.service ??
      new SystemPowerService(repository, adapter, config.evaluator ?? new PowerPolicyEvaluator(), clock);
  }

  async start(): Promise<void> {
    if (this.config.enabled === false) {
      return;
    }

    await this.service.evaluatePowerPolicy();
  }

  async evaluatePowerPolicy(input = {}) {
    return this.service.evaluatePowerPolicy(input);
  }

  async acquireInhibitor(input = {}) {
    return this.service.acquireInhibitor(input);
  }

  async releaseInhibitor(input = {}) {
    return this.service.releaseInhibitor(input);
  }

  async getPowerStatus() {
    return this.service.getPowerStatus();
  }

  async updatePowerPolicy(update: PowerPolicyUpdate) {
    return this.service.updatePowerPolicy(update);
  }

  async health() {
    const status = await this.service.getPowerStatus();

    return {
      status: 'healthy' as const,
      details: {
        module: this.name,
        mode: status.policy.mode,
        inhibitorActive: status.inhibitorActive,
      },
    };
  }
}
