import { SystemClock, type Clock } from '@lume-hub/clock';
import {
  GroupCalendarArchiveRepository,
  GroupCalendarFileRepository,
  type GroupCalendarArchiveEntry,
  type GroupCalendarCreationInput,
  type GroupCalendarEventRecord,
  type GroupCalendarMonthFile,
} from '@lume-hub/persistence-group-files';

import { PastEventCleanupPolicy } from '../../domain/services/PastEventCleanupPolicy.js';

export interface NotificationJobCleanupInput {
  readonly groupJid?: string;
  readonly now?: Date;
}

export interface NotificationJobCleanupResult {
  readonly archivedEventCount: number;
  readonly archivedDeliveryAttemptCount: number;
  readonly touchedCalendarMonths: number;
}

export class NotificationJobCleanupService {
  constructor(
    private readonly calendarRepository: GroupCalendarFileRepository,
    private readonly archiveRepository: GroupCalendarArchiveRepository,
    private readonly policy = new PastEventCleanupPolicy(),
    private readonly clock: Clock = new SystemClock(),
  ) {}

  async cleanupPastEvents(input: NotificationJobCleanupInput = {}): Promise<NotificationJobCleanupResult> {
    const now = input.now ?? this.clock.now();
    const calendars = await this.calendarRepository.listCalendarMonths(input.groupJid);
    let archivedEventCount = 0;
    let archivedDeliveryAttemptCount = 0;
    let touchedCalendarMonths = 0;

    for (const calendar of calendars) {
      const eventsToArchive = calendar.events.filter((event) => this.policy.shouldArchiveEvent(event, now));

      if (eventsToArchive.length === 0) {
        continue;
      }

      const archiveEntries = buildArchiveEntries(calendar, eventsToArchive, now);
      const existingArchive = await this.archiveRepository.ensureArchiveMonth(toCreationInput(calendar));

      await this.archiveRepository.saveArchiveMonth({
        ...existingArchive,
        groupLabel: calendar.groupLabel,
        timezone: calendar.timezone,
        archivedEvents: mergeArchiveEntries(existingArchive.archivedEvents, archiveEntries),
      });

      const archivedEventIds = new Set(eventsToArchive.map((event) => event.eventId));
      const archivedJobIds = new Set(eventsToArchive.flatMap((event) => event.notifications.map((notification) => notification.jobId)));

      await this.calendarRepository.saveCalendarMonth({
        ...calendar,
        events: calendar.events.filter((event) => !archivedEventIds.has(event.eventId)),
        deliveryAttempts: calendar.deliveryAttempts.filter(
          (attempt) => !archivedEventIds.has(attempt.eventId) && !archivedJobIds.has(attempt.jobId),
        ),
      });

      archivedEventCount += archiveEntries.length;
      archivedDeliveryAttemptCount += archiveEntries.reduce((sum, entry) => sum + entry.deliveryAttempts.length, 0);
      touchedCalendarMonths += 1;
    }

    return {
      archivedEventCount,
      archivedDeliveryAttemptCount,
      touchedCalendarMonths,
    };
  }
}

function buildArchiveEntries(
  calendar: GroupCalendarMonthFile,
  events: readonly GroupCalendarEventRecord[],
  now: Date,
): GroupCalendarArchiveEntry[] {
  return events.map((event) => {
    const jobIds = new Set(event.notifications.map((notification) => notification.jobId));

    return {
      archivedAt: now.toISOString(),
      reason: 'past_event_cleanup',
      event,
      deliveryAttempts: calendar.deliveryAttempts.filter(
        (attempt) => attempt.eventId === event.eventId || jobIds.has(attempt.jobId),
      ),
    };
  });
}

function mergeArchiveEntries(
  currentEntries: readonly GroupCalendarArchiveEntry[],
  nextEntries: readonly GroupCalendarArchiveEntry[],
): GroupCalendarArchiveEntry[] {
  const merged = new Map<string, GroupCalendarArchiveEntry>();

  for (const entry of currentEntries) {
    merged.set(entry.event.eventId, entry);
  }

  for (const entry of nextEntries) {
    merged.set(entry.event.eventId, entry);
  }

  return [...merged.values()].sort(
    (left, right) =>
      left.event.eventAt.localeCompare(right.event.eventAt) ||
      left.event.eventId.localeCompare(right.event.eventId),
  );
}

function toCreationInput(calendar: GroupCalendarMonthFile): GroupCalendarCreationInput {
  return {
    groupJid: calendar.groupJid,
    groupLabel: calendar.groupLabel,
    year: calendar.year,
    month: calendar.month,
    timezone: calendar.timezone,
  };
}
