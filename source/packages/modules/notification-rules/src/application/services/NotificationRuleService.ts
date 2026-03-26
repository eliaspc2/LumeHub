import type { ScheduleEventService } from '@lume-hub/schedule-events';

import type {
  NotificationRule,
  NotificationRuleDefinitionInput,
} from '../../domain/entities/NotificationRule.js';
import type {
  NotificationRuleQuery,
  NotificationRuleRepository,
} from '../../domain/repositories/NotificationRuleRepository.js';
import { NotificationRulePolicyEngine } from '../../domain/services/NotificationRulePolicyEngine.js';

export class NotificationRuleService {
  constructor(
    private readonly repository: NotificationRuleRepository,
    private readonly policyEngine: NotificationRulePolicyEngine,
    private readonly scheduleEventService: ScheduleEventService,
  ) {}

  async deriveRulesForEvent(
    eventId: string,
    definitions?: readonly NotificationRuleDefinitionInput[],
    query: NotificationRuleQuery = {},
  ): Promise<readonly NotificationRule[]> {
    const event = await this.scheduleEventService.findEventById(eventId, query);

    if (!event) {
      throw new Error(`Event '${eventId}' was not found.`);
    }

    return this.repository.replaceRules(eventId, this.policyEngine.derive(event, definitions), query);
  }

  async replaceRulesForEvent(
    eventId: string,
    definitions: readonly NotificationRuleDefinitionInput[],
    query: NotificationRuleQuery = {},
  ): Promise<readonly NotificationRule[]> {
    const event = await this.scheduleEventService.findEventById(eventId, query);

    if (!event) {
      throw new Error(`Event '${eventId}' was not found.`);
    }

    return this.repository.replaceRules(eventId, this.policyEngine.derive(event, definitions), query);
  }

  async listRulesForEvent(eventId: string, query: NotificationRuleQuery = {}): Promise<readonly NotificationRule[]> {
    return this.repository.listRules(eventId, query);
  }
}
