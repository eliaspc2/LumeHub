import { WeekCalculator } from '@lume-hub/schedule-weeks';

import type { ScheduleEvent, ScheduleEventUpdateInput } from '../entities/ScheduleEvent.js';

function normalizeDate(input: Date | string): string {
  const value = input instanceof Date ? input : new Date(input);

  if (Number.isNaN(value.getTime())) {
    throw new Error(`Invalid event date '${String(input)}'.`);
  }

  return value.toISOString();
}

export class ScheduleEventMutator {
  constructor(private readonly weekCalculator = new WeekCalculator()) {}

  apply(event: ScheduleEvent, changes: ScheduleEventUpdateInput): ScheduleEvent {
    const nextEventAt = changes.eventAt === undefined ? event.eventAt : normalizeDate(changes.eventAt);
    const eventAtChanged = nextEventAt !== event.eventAt;
    const nextWeekId = this.weekCalculator.weekIdForDate(nextEventAt, event.timeZone);
    const nextRules = (changes.notificationRules ?? event.notificationRules).map((rule) => ({
      ...rule,
      eventId: event.eventId,
      weekId: nextWeekId,
    }));
    const nextNotifications = (
      changes.notifications ??
      (eventAtChanged
        ? []
        : event.notifications.map((notification) => ({
            ...notification,
            weekId: nextWeekId,
          })))
    ).map((notification) => ({
      ...notification,
      weekId: nextWeekId,
    }));

    return {
      ...event,
      weekId: nextWeekId,
      title: changes.title === undefined ? event.title : changes.title.trim() || event.title,
      kind: changes.kind ?? event.kind,
      target: changes.target === undefined ? event.target : changes.target ?? undefined,
      eventAt: nextEventAt,
      metadata: changes.metadata === undefined ? event.metadata : changes.metadata ?? undefined,
      notificationRules: nextRules,
      notifications: nextNotifications,
    };
  }
}
