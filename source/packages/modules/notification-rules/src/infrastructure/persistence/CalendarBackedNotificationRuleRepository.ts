import { type ScheduleEventService } from '@lume-hub/schedule-events';

import type { NotificationRule } from '../../domain/entities/NotificationRule.js';
import type {
  NotificationRuleQuery,
  NotificationRuleRepository,
} from '../../domain/repositories/NotificationRuleRepository.js';

export class CalendarBackedNotificationRuleRepository implements NotificationRuleRepository {
  constructor(private readonly scheduleEventService: ScheduleEventService) {}

  async listRules(eventId: string, query: NotificationRuleQuery = {}): Promise<readonly NotificationRule[]> {
    const event = await this.scheduleEventService.findEventById(eventId, query);
    return event?.notificationRules ?? [];
  }

  async replaceRules(
    eventId: string,
    rules: readonly NotificationRule[],
    query: NotificationRuleQuery = {},
  ): Promise<readonly NotificationRule[]> {
    const updated = await this.scheduleEventService.updateEvent(
      eventId,
      {
        notificationRules: rules.map((rule) => ({
          ...rule,
          eventId,
        })),
        notifications: [],
      },
      query,
    );

    return updated.notificationRules;
  }
}
