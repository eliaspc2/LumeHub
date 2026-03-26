import { BaseModule } from '@lume-hub/kernel';
import {
  CalendarBackedScheduleEventRepository,
  ScheduleEventFactory,
  ScheduleEventMutator,
  ScheduleEventService,
} from '@lume-hub/schedule-events';
import { GroupCalendarFileRepository, GroupPathResolver } from '@lume-hub/persistence-group-files';
import { WeekCalculator } from '@lume-hub/schedule-weeks';

import { NotificationRuleService } from '../application/services/NotificationRuleService.js';
import { NotificationRulePolicyEngine } from '../domain/services/NotificationRulePolicyEngine.js';
import { CalendarBackedNotificationRuleRepository } from '../infrastructure/persistence/CalendarBackedNotificationRuleRepository.js';
import type { NotificationRulesModuleContract } from '../public/contracts/index.js';
import type { NotificationRulesModuleConfig } from './NotificationRulesModuleConfig.js';

export class NotificationRulesModule extends BaseModule implements NotificationRulesModuleContract {
  readonly moduleName = 'notification-rules' as const;
  readonly service: NotificationRuleService;

  constructor(readonly config: NotificationRulesModuleConfig = {}) {
    super({
      name: 'notification-rules',
      version: '0.2.0',
      dependencies: ['schedule-events'],
    });

    const weekCalculator = new WeekCalculator();
    const scheduleEventService =
      config.scheduleEventService ??
      new ScheduleEventService(
        new CalendarBackedScheduleEventRepository(
          new GroupCalendarFileRepository(
            new GroupPathResolver({
              dataRootPath: config.dataRootPath,
            }),
          ),
          weekCalculator,
        ),
        new ScheduleEventFactory(weekCalculator),
        new ScheduleEventMutator(weekCalculator),
      );
    const repository = config.repository ?? new CalendarBackedNotificationRuleRepository(scheduleEventService);
    const policyEngine = config.policyEngine ?? new NotificationRulePolicyEngine();

    this.service = config.service ?? new NotificationRuleService(repository, policyEngine, scheduleEventService);
  }

  async deriveRulesForEvent(
    eventId: string,
    definitions?: readonly import('../domain/entities/NotificationRule.js').NotificationRuleDefinitionInput[],
    query = {},
  ) {
    return this.service.deriveRulesForEvent(eventId, definitions, query);
  }

  async replaceRulesForEvent(
    eventId: string,
    definitions: readonly import('../domain/entities/NotificationRule.js').NotificationRuleDefinitionInput[],
    query = {},
  ) {
    return this.service.replaceRulesForEvent(eventId, definitions, query);
  }

  async listRulesForEvent(eventId: string, query = {}) {
    return this.service.listRulesForEvent(eventId, query);
  }
}
