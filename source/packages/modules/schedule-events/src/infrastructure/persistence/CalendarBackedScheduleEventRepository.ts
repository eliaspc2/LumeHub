import {
  DEFAULT_TIMEZONE,
  GroupCalendarFileRepository,
  type GroupCalendarEventRecord,
  type GroupCalendarMonthFile,
} from '@lume-hub/persistence-group-files';
import { WeekCalculator } from '@lume-hub/schedule-weeks';

import type { ScheduleEvent } from '../../domain/entities/ScheduleEvent.js';
import type {
  ScheduleEventLookupQuery,
  ScheduleEventQuery,
  ScheduleEventRepository,
} from '../../domain/repositories/ScheduleEventRepository.js';

function sortEvents(left: GroupCalendarEventRecord, right: GroupCalendarEventRecord): number {
  return left.eventAt.localeCompare(right.eventAt) || left.eventId.localeCompare(right.eventId);
}

function monthKey(groupJid: string, year: number, month: number): string {
  return `${groupJid}:${year}-${String(month).padStart(2, '0')}`;
}

export class CalendarBackedScheduleEventRepository implements ScheduleEventRepository {
  constructor(
    private readonly calendarRepository = new GroupCalendarFileRepository(),
    private readonly weekCalculator = new WeekCalculator(),
  ) {}

  async saveEvent(event: ScheduleEvent): Promise<ScheduleEvent> {
    const requestedMonth = this.weekCalculator.calendarMonthForDate(event.eventAt, event.timeZone);
    const currentTargetMonth =
      await this.calendarRepository.readCalendarMonth({
        groupJid: event.groupJid,
        year: requestedMonth.year,
        month: requestedMonth.month,
      }) ??
      await this.calendarRepository.ensureCalendarMonth({
        groupJid: event.groupJid,
        groupLabel: event.groupLabel,
        year: requestedMonth.year,
        month: requestedMonth.month,
        timezone: event.timeZone,
      });
    const normalizedEvent = this.normalizeEvent(event, currentTargetMonth.groupLabel, currentTargetMonth.timezone);
    const targetMonthRef = this.weekCalculator.calendarMonthForDate(normalizedEvent.eventAt, normalizedEvent.timeZone);
    const calendars = await this.calendarRepository.listCalendarMonths(event.groupJid);
    const updatedCalendars = new Map<string, GroupCalendarMonthFile>();

    for (const calendar of calendars) {
      const filteredEvents = calendar.events.filter((candidate) => candidate.eventId !== normalizedEvent.eventId);

      if (filteredEvents.length !== calendar.events.length) {
        updatedCalendars.set(
          monthKey(calendar.groupJid, calendar.year, calendar.month),
          {
            ...calendar,
            events: filteredEvents,
          },
        );
      }
    }

    const targetKey = monthKey(normalizedEvent.groupJid, targetMonthRef.year, targetMonthRef.month);
    const targetMonth =
      updatedCalendars.get(targetKey) ??
      currentTargetMonth;
    const nextTargetMonth = {
      ...targetMonth,
      events: [
        ...targetMonth.events.filter((candidate) => candidate.eventId !== normalizedEvent.eventId),
        this.toRecord(normalizedEvent),
      ].sort(sortEvents),
    };

    for (const [key, calendar] of updatedCalendars.entries()) {
      if (key === targetKey) {
        continue;
      }

      await this.calendarRepository.saveCalendarMonth(calendar);
    }

    const savedTargetMonth = await this.calendarRepository.saveCalendarMonth(nextTargetMonth);
    const savedRecord = savedTargetMonth.events.find((candidate) => candidate.eventId === normalizedEvent.eventId);

    if (!savedRecord) {
      throw new Error(`Failed to persist event '${normalizedEvent.eventId}'.`);
    }

    return this.toEntity(savedRecord, savedTargetMonth);
  }

  async readEvent(eventId: string, query: ScheduleEventLookupQuery = {}): Promise<ScheduleEvent | undefined> {
    const calendars = await this.calendarRepository.listCalendarMonths(query.groupJid);

    for (const calendar of calendars) {
      const record = calendar.events.find((candidate) => candidate.eventId === eventId);

      if (record) {
        return this.toEntity(record, calendar);
      }
    }

    return undefined;
  }

  async deleteEvent(eventId: string, query: ScheduleEventLookupQuery = {}): Promise<boolean> {
    const calendars = await this.calendarRepository.listCalendarMonths(query.groupJid);
    let removed = false;

    for (const calendar of calendars) {
      const nextEvents = calendar.events.filter((candidate) => candidate.eventId !== eventId);

      if (nextEvents.length === calendar.events.length) {
        continue;
      }

      removed = true;
      await this.calendarRepository.saveCalendarMonth({
        ...calendar,
        events: nextEvents,
      });
    }

    return removed;
  }

  async listEvents(query: ScheduleEventQuery = {}): Promise<readonly ScheduleEvent[]> {
    const calendars = await this.calendarRepository.listCalendarMonths(query.groupJid);

    return calendars
      .flatMap((calendar) =>
        calendar.events.map((event) => this.toEntity(event, calendar)),
      )
      .filter((event) => !query.weekId || event.weekId === query.weekId)
      .sort((left, right) => left.eventAt.localeCompare(right.eventAt) || left.eventId.localeCompare(right.eventId));
  }

  private normalizeEvent(event: ScheduleEvent, groupLabel: string, timeZone: string): ScheduleEvent {
    const weekId = this.weekCalculator.weekIdForDate(event.eventAt, timeZone);

    return {
      ...event,
      groupLabel,
      timeZone,
      weekId,
      notificationRules: event.notificationRules.map((rule) => ({
        ...rule,
        eventId: event.eventId,
        weekId,
      })),
      notifications: event.notifications.map((notification) => ({
        ...notification,
        weekId,
      })),
    };
  }

  private toEntity(record: GroupCalendarEventRecord, calendar: GroupCalendarMonthFile): ScheduleEvent {
    return {
      eventId: record.eventId,
      weekId: record.weekId,
      groupJid: record.groupJid,
      groupLabel: record.groupLabel,
      title: record.title,
      kind: record.kind,
      target: record.target,
      eventAt: record.eventAt,
      timeZone: calendar.timezone ?? DEFAULT_TIMEZONE,
      notificationRules: record.notificationRules,
      notifications: record.notifications,
      metadata: record.metadata,
    };
  }

  private toRecord(event: ScheduleEvent): GroupCalendarEventRecord {
    return {
      eventId: event.eventId,
      weekId: event.weekId,
      groupJid: event.groupJid,
      groupLabel: event.groupLabel,
      title: event.title,
      kind: event.kind,
      target: event.target,
      eventAt: event.eventAt,
      notificationRules: [...event.notificationRules],
      notifications: [...event.notifications],
      metadata: event.metadata ? { ...event.metadata } : undefined,
    };
  }
}
