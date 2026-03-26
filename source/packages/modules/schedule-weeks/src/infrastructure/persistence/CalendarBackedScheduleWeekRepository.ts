import {
  DEFAULT_TIMEZONE,
  GroupCalendarFileRepository,
  type GroupCalendarEventRecord,
} from '@lume-hub/persistence-group-files';

import type { ScheduleWeek, ScheduleWeekFile } from '../../domain/entities/ScheduleWeek.js';
import type { ScheduleWeekQuery, ScheduleWeekRepository } from '../../domain/repositories/ScheduleWeekRepository.js';
import { WeekCalculator } from '../../domain/services/WeekCalculator.js';

function sortByWeekId(left: string, right: string): number {
  return left.localeCompare(right);
}

export class CalendarBackedScheduleWeekRepository implements ScheduleWeekRepository {
  constructor(
    private readonly calendarRepository = new GroupCalendarFileRepository(),
    private readonly weekCalculator = new WeekCalculator(),
  ) {}

  async listWeeks(query: ScheduleWeekQuery = {}): Promise<readonly ScheduleWeek[]> {
    const calendars = await this.calendarRepository.listCalendarMonths(query.groupJid);
    const index = new Map<string, { groupJids: Set<string>; eventCount: number; timeZone: string }>();

    for (const calendar of calendars) {
      for (const event of calendar.events) {
        const current = index.get(event.weekId) ?? {
          groupJids: new Set<string>(),
          eventCount: 0,
          timeZone: query.timeZone ?? calendar.timezone,
        };
        current.groupJids.add(event.groupJid);
        current.eventCount += 1;
        index.set(event.weekId, current);
      }
    }

    return [...index.entries()]
      .sort(([left], [right]) => sortByWeekId(left, right))
      .map(([weekId, value]) => ({
        weekId,
        range: this.weekCalculator.weekRange(weekId, value.timeZone),
        groupJids: [...value.groupJids].sort((left, right) => left.localeCompare(right)),
        eventCount: value.eventCount,
      }));
  }

  async readWeekFile(weekId: string, query: ScheduleWeekQuery = {}): Promise<ScheduleWeekFile | undefined> {
    const calendars = await this.calendarRepository.listCalendarMonths(query.groupJid);
    const matchedEvents: GroupCalendarEventRecord[] = [];
    const matchedGroups = new Set<string>();
    let groupLabel: string | undefined;
    let timeZone = query.timeZone ?? DEFAULT_TIMEZONE;

    for (const calendar of calendars) {
      const weekEvents = calendar.events.filter((event) => event.weekId === weekId);

      if (weekEvents.length === 0) {
        continue;
      }

      matchedEvents.push(...weekEvents);
      matchedGroups.add(calendar.groupJid);
      timeZone = query.timeZone ?? calendar.timezone;

      if (!groupLabel && query.groupJid && calendar.groupJid === query.groupJid) {
        groupLabel = calendar.groupLabel;
      }
    }

    if (matchedEvents.length === 0) {
      return undefined;
    }

    return {
      weekId,
      groupJid: query.groupJid,
      groupLabel,
      groupJids: [...matchedGroups].sort((left, right) => left.localeCompare(right)),
      timeZone,
      generatedAt: new Date().toISOString(),
      eventCount: matchedEvents.length,
      events: matchedEvents
        .slice()
        .sort((left, right) => left.eventAt.localeCompare(right.eventAt))
        .map((event) => ({
          eventId: event.eventId,
          weekId: event.weekId,
          groupJid: event.groupJid,
          groupLabel: event.groupLabel,
          title: event.title,
          kind: event.kind,
          eventAt: event.eventAt,
        })),
    };
  }
}
