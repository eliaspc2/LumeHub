import type { ScheduleEventService } from '@lume-hub/schedule-events';

import type { NotificationRuleService } from '../application/services/NotificationRuleService.js';
import type { NotificationRuleRepository } from '../domain/repositories/NotificationRuleRepository.js';
import type { NotificationRulePolicyEngine } from '../domain/services/NotificationRulePolicyEngine.js';

export interface NotificationRulesModuleConfig {
  readonly dataRootPath?: string;
  readonly scheduleEventService?: ScheduleEventService;
  readonly repository?: NotificationRuleRepository;
  readonly service?: NotificationRuleService;
  readonly policyEngine?: NotificationRulePolicyEngine;
}
