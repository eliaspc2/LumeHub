import type { Clock } from '@lume-hub/clock';

import type { SystemPowerService } from '../application/services/SystemPowerService.js';
import type { PowerPolicyRepository } from '../infrastructure/persistence/PowerPolicyRepository.js';
import type { SleepInhibitorAdapter } from '../infrastructure/system/SleepInhibitorAdapter.js';
import type { PowerPolicyEvaluator } from '../domain/services/PowerPolicyEvaluator.js';

export interface SystemPowerModuleConfig {
  readonly enabled?: boolean;
  readonly stateFilePath?: string;
  readonly inhibitorStatePath?: string;
  readonly clock?: Clock;
  readonly repository?: PowerPolicyRepository;
  readonly adapter?: SleepInhibitorAdapter;
  readonly evaluator?: PowerPolicyEvaluator;
  readonly service?: SystemPowerService;
}
