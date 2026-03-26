import type { AcquireInhibitorInput, EvaluatePowerPolicyInput } from '../../application/services/SystemPowerService.js';
import type { PowerInhibitLease } from '../../domain/entities/PowerInhibitLease.js';
import type { PowerPolicy, PowerPolicyUpdate } from '../../domain/entities/PowerPolicy.js';
import type { PowerStatus } from '../../domain/entities/PowerStatus.js';

export interface SystemPowerModuleContract {
  readonly moduleName: 'system-power';

  evaluatePowerPolicy(input?: EvaluatePowerPolicyInput): Promise<PowerStatus>;
  acquireInhibitor(input?: AcquireInhibitorInput): Promise<PowerStatus>;
  releaseInhibitor(input?: { readonly now?: Date }): Promise<PowerInhibitLease | undefined>;
  getPowerStatus(): Promise<PowerStatus>;
  updatePowerPolicy(update: PowerPolicyUpdate): Promise<PowerPolicy>;
}
