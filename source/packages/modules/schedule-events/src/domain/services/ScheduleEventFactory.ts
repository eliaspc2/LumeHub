import { randomUUID } from 'node:crypto';

import { DEFAULT_TIMEZONE } from '@lume-hub/persistence-group-files';
import { WeekCalculator } from '@lume-hub/schedule-weeks';

import type { ScheduleEvent, ScheduleEventCreateInput } from '../entities/ScheduleEvent.js';

function normalizeDate(input: Date | string): string {
  const value = input instanceof Date ? input : new Date(input);

  if (Number.isNaN(value.getTime())) {
    throw new Error(`Invalid event date '${String(input)}'.`);
  }

  return value.toISOString();
}

export class ScheduleEventFactory {
  constructor(private readonly weekCalculator = new WeekCalculator()) {}

  create(input: ScheduleEventCreateInput): ScheduleEvent {
    const timeZone = input.timeZone ?? DEFAULT_TIMEZONE;
    const eventAt = normalizeDate(input.eventAt);

    return {
      eventId: input.eventId ?? `evt-${randomUUID()}`,
      weekId: this.weekCalculator.weekIdForDate(eventAt, timeZone),
      groupJid: input.groupJid,
      groupLabel: input.groupLabel,
      title: input.title?.trim() || 'Untitled event',
      kind: input.kind ?? 'generic',
      target: input.target,
      eventAt,
      timeZone,
      notificationRules: [],
      notifications: [],
      metadata: input.metadata,
    };
  }
}
