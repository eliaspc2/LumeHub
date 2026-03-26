import {
  DEFAULT_TIMEZONE,
  GroupCalendarFileRepository,
  type GroupCalendarMonthFile,
  type GroupDeliveryAttemptRecord,
} from '@lume-hub/persistence-group-files';
import { WeekCalculator } from '@lume-hub/schedule-weeks';

import type { DeliveryAttempt } from '../../domain/entities/DeliveryAttempt.js';
import type {
  DeliveryAttemptLookupQuery,
  DeliveryAttemptQuery,
  DeliveryAttemptRepository,
} from '../../domain/repositories/DeliveryAttemptRepository.js';

function monthKey(groupJid: string, year: number, month: number): string {
  return `${groupJid}:${year}-${String(month).padStart(2, '0')}`;
}

function sortAttempts(left: GroupDeliveryAttemptRecord, right: GroupDeliveryAttemptRecord): number {
  return left.startedAt.localeCompare(right.startedAt) || left.attemptId.localeCompare(right.attemptId);
}

export class CalendarBackedDeliveryAttemptRepository implements DeliveryAttemptRepository {
  constructor(
    private readonly calendarRepository = new GroupCalendarFileRepository(),
    private readonly weekCalculator = new WeekCalculator(),
  ) {}

  async listAttempts(query: DeliveryAttemptQuery = {}): Promise<readonly DeliveryAttempt[]> {
    const calendars = await this.calendarRepository.listCalendarMonths(query.groupJid);

    return calendars
      .flatMap((calendar) => calendar.deliveryAttempts.map((attempt) => this.toEntity(attempt)))
      .filter((attempt) => !query.jobId || attempt.jobId === query.jobId)
      .filter((attempt) => !query.messageId || attempt.messageId === query.messageId)
      .filter((attempt) => !query.status || attempt.status === query.status)
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt) || left.attemptId.localeCompare(right.attemptId));
  }

  async readAttemptById(
    attemptId: string,
    query: DeliveryAttemptLookupQuery = {},
  ): Promise<DeliveryAttempt | undefined> {
    return (await this.listAttempts(query)).find((attempt) => attempt.attemptId === attemptId);
  }

  async readAttemptByMessageId(
    messageId: string,
    query: DeliveryAttemptLookupQuery = {},
  ): Promise<DeliveryAttempt | undefined> {
    return (await this.listAttempts(query)).find((attempt) => attempt.messageId === messageId);
  }

  async readLatestAttemptForJob(
    jobId: string,
    query: DeliveryAttemptLookupQuery = {},
  ): Promise<DeliveryAttempt | undefined> {
    return (await this.listAttempts({
      ...query,
      jobId,
    }))
      .slice()
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt) || right.attemptId.localeCompare(left.attemptId))[0];
  }

  async saveAttempt(attempt: DeliveryAttempt): Promise<DeliveryAttempt> {
    const calendars = await this.calendarRepository.listCalendarMonths(attempt.groupJid);
    const updatedCalendars = new Map<string, GroupCalendarMonthFile>();
    let targetCalendar = calendars.find((calendar) =>
      calendar.events.some((event) =>
        event.eventId === attempt.eventId ||
        event.notifications.some((notification) => notification.jobId === attempt.jobId),
      ),
    );

    if (!targetCalendar) {
      const monthReference = this.weekCalculator.calendarMonthForDate(attempt.startedAt, DEFAULT_TIMEZONE);
      targetCalendar = await this.calendarRepository.ensureCalendarMonth({
        groupJid: attempt.groupJid,
        groupLabel: attempt.groupLabel,
        year: monthReference.year,
        month: monthReference.month,
        timezone: DEFAULT_TIMEZONE,
      });
    }

    for (const calendar of calendars) {
      const filteredAttempts = calendar.deliveryAttempts.filter((current) => current.attemptId !== attempt.attemptId);

      if (filteredAttempts.length !== calendar.deliveryAttempts.length) {
        updatedCalendars.set(
          monthKey(calendar.groupJid, calendar.year, calendar.month),
          {
            ...calendar,
            deliveryAttempts: filteredAttempts,
          },
        );
      }
    }

    const targetKey = monthKey(targetCalendar.groupJid, targetCalendar.year, targetCalendar.month);
    const targetBase = updatedCalendars.get(targetKey) ?? targetCalendar;
    const nextTarget = {
      ...targetBase,
      deliveryAttempts: [
        ...targetBase.deliveryAttempts.filter((current) => current.attemptId !== attempt.attemptId),
        this.toRecord(attempt),
      ].sort(sortAttempts),
    };

    for (const [key, calendar] of updatedCalendars.entries()) {
      if (key === targetKey) {
        continue;
      }

      await this.calendarRepository.saveCalendarMonth(calendar);
    }

    const savedCalendar = await this.calendarRepository.saveCalendarMonth(nextTarget);
    const savedAttempt = savedCalendar.deliveryAttempts.find((current) => current.attemptId === attempt.attemptId);

    if (!savedAttempt) {
      throw new Error(`Failed to persist delivery attempt '${attempt.attemptId}'.`);
    }

    return this.toEntity(savedAttempt);
  }

  private toEntity(record: GroupDeliveryAttemptRecord): DeliveryAttempt {
    return {
      attemptId: record.attemptId,
      jobId: record.jobId,
      eventId: record.eventId,
      weekId: record.weekId,
      groupJid: record.groupJid,
      groupLabel: record.groupLabel,
      messageId: record.messageId,
      startedAt: record.startedAt,
      status: record.status,
      lastError: record.lastError,
      observation: record.observation ?? null,
      confirmation: record.confirmation ?? null,
    };
  }

  private toRecord(attempt: DeliveryAttempt): GroupDeliveryAttemptRecord {
    return {
      attemptId: attempt.attemptId,
      jobId: attempt.jobId,
      eventId: attempt.eventId,
      weekId: attempt.weekId,
      groupJid: attempt.groupJid,
      groupLabel: attempt.groupLabel,
      messageId: attempt.messageId,
      startedAt: attempt.startedAt,
      status: attempt.status,
      lastError: attempt.lastError,
      observation: attempt.observation ?? null,
      confirmation: attempt.confirmation ?? null,
    };
  }
}
