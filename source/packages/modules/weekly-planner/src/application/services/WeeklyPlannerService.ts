import type { AdminConfigModuleContract } from '@lume-hub/admin-config';
import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { NotificationJobsModuleContract } from '@lume-hub/notification-jobs';
import type { NotificationRulesModuleContract } from '@lume-hub/notification-rules';
import type { ScheduleEventsModuleContract, ScheduleEvent } from '@lume-hub/schedule-events';
import { WeekCalculator, type ScheduleWeeksModuleContract } from '@lume-hub/schedule-weeks';

import type {
  WeeklyPlannerEventSummary,
  WeeklyPlannerGroupSummary,
  WeeklyPlannerQuery,
  WeeklyPlannerSnapshot,
  WeeklyPlannerUpsertInput,
} from '../../domain/entities/WeeklyPlanner.js';

const DEFAULT_TIME_ZONE = 'Europe/Lisbon';
const DAY_LABELS = ['domingo', 'segunda-feira', 'terca-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sabado'];
const DAY_INDEX_BY_LABEL = new Map<string, number>([
  ['domingo', 0],
  ['segunda-feira', 1],
  ['terca-feira', 2],
  ['terça-feira', 2],
  ['quarta-feira', 3],
  ['quinta-feira', 4],
  ['sexta-feira', 5],
  ['sabado', 6],
  ['sábado', 6],
]);

export interface WeeklyPlannerServiceConfig {
  readonly adminConfig: Pick<AdminConfigModuleContract, 'getSettings'>;
  readonly groupDirectory: Pick<GroupDirectoryModuleContract, 'listGroups'>;
  readonly notificationJobs: Pick<NotificationJobsModuleContract, 'materializeForEvent'>;
  readonly notificationRules: Pick<NotificationRulesModuleContract, 'replaceRulesForEvent'>;
  readonly scheduleEvents: Pick<
    ScheduleEventsModuleContract,
    'createEvent' | 'updateEvent' | 'deleteEvent' | 'listEventsByWeek' | 'findEventById'
  >;
  readonly scheduleWeeks: Pick<ScheduleWeeksModuleContract, 'getCurrentWeek'>;
  readonly defaultTimeZone?: string;
  readonly weekCalculator?: WeekCalculator;
}

export class WeeklyPlannerService {
  private readonly defaultTimeZone: string;
  private readonly weekCalculator: WeekCalculator;

  constructor(private readonly config: WeeklyPlannerServiceConfig) {
    this.defaultTimeZone = config.defaultTimeZone ?? DEFAULT_TIME_ZONE;
    this.weekCalculator = config.weekCalculator ?? new WeekCalculator();
  }

  async getWeekSnapshot(query: WeeklyPlannerQuery = {}): Promise<WeeklyPlannerSnapshot> {
    const timeZone = query.timeZone ?? this.defaultTimeZone;
    const weekId =
      query.weekId ??
      (await this.config.scheduleWeeks.getCurrentWeek({
        groupJid: query.groupJid,
        timeZone,
        now: query.now,
      })).weekId;
    const [settings, groups, events] = await Promise.all([
      this.config.adminConfig.getSettings(),
      this.config.groupDirectory.listGroups(),
      this.config.scheduleEvents.listEventsByWeek(weekId, query.groupJid ? { groupJid: query.groupJid } : {}),
    ]);
    const groupsByJid = new Map(groups.map((group) => [group.groupJid, group]));
    const visibleGroups = (query.groupJid ? groups.filter((group) => group.groupJid === query.groupJid) : groups).map(
      (group): WeeklyPlannerGroupSummary => ({
        groupJid: group.groupJid,
        preferredSubject: group.preferredSubject,
        courseId: group.courseId,
        ownerLabels: group.groupOwners.map((owner) => owner.personId),
      }),
    );
    const mappedEvents = events
      .slice()
      .sort((left, right) => left.eventAt.localeCompare(right.eventAt) || left.eventId.localeCompare(right.eventId))
      .map((event) => this.mapEventSummary(event, groupsByJid.get(event.groupJid)?.preferredSubject, timeZone));

    return {
      timezone: timeZone,
      focusWeekLabel: weekId,
      focusWeekRangeLabel: formatWeekRange(this.weekCalculator.weekRange(weekId, timeZone)),
      groupsKnown: visibleGroups.length,
      groups: visibleGroups,
      defaultNotificationRuleLabels: settings.ui.defaultNotificationRules.map((rule) => rule.label ?? rule.kind),
      events: mappedEvents,
      diagnostics: {
        eventCount: mappedEvents.length,
        pendingNotifications: mappedEvents.reduce((sum, event) => sum + event.notifications.pending, 0),
        waitingConfirmationNotifications: mappedEvents.reduce(
          (sum, event) => sum + event.notifications.waitingConfirmation,
          0,
        ),
        sentNotifications: mappedEvents.reduce((sum, event) => sum + event.notifications.sent, 0),
      },
    };
  }

  async saveSchedule(input: WeeklyPlannerUpsertInput): Promise<WeeklyPlannerEventSummary> {
    const group = (await this.config.groupDirectory.listGroups()).find((candidate) => candidate.groupJid === input.groupJid);

    if (!group) {
      throw new Error(`Unknown group '${input.groupJid}'.`);
    }

    const timeZone = input.timeZone ?? this.defaultTimeZone;
    const weekId =
      input.weekId ??
      (await this.config.scheduleWeeks.getCurrentWeek({
        groupJid: input.groupJid,
        timeZone,
      })).weekId;
    const eventAt = this.resolveEventAt({
      weekId,
      localDate: input.localDate,
      dayLabel: input.dayLabel,
      startTime: input.startTime,
      timeZone,
    });
    const notificationRules =
      input.notificationRules ??
      (await this.config.adminConfig.getSettings()).ui.defaultNotificationRules;
    const metadata = {
      durationMinutes: input.durationMinutes,
      notes: input.notes?.trim() ?? '',
    };

    const event = input.eventId
      ? await this.config.scheduleEvents.updateEvent(
          input.eventId,
          {
            title: input.title,
            eventAt,
            metadata,
          },
          {
            groupJid: input.groupJid,
          },
        )
      : await this.config.scheduleEvents.createEvent({
          groupJid: input.groupJid,
          groupLabel: group.preferredSubject,
          title: input.title,
          eventAt,
          timeZone,
          metadata,
        });

    await this.config.notificationRules.replaceRulesForEvent(event.eventId, notificationRules, {
      groupJid: event.groupJid,
    });
    await this.config.notificationJobs.materializeForEvent(event.eventId, {
      groupJid: event.groupJid,
    });
    const refreshedEvent =
      (await this.config.scheduleEvents.findEventById(event.eventId, {
        groupJid: event.groupJid,
      })) ?? event;

    return this.mapEventSummary(refreshedEvent, group.preferredSubject, timeZone);
  }

  async deleteSchedule(eventId: string, query: { readonly groupJid?: string } = {}): Promise<boolean> {
    return this.config.scheduleEvents.deleteEvent(eventId, query);
  }

  private resolveEventAt(input: {
    readonly weekId: string;
    readonly localDate?: string;
    readonly dayLabel?: string;
    readonly startTime: string;
    readonly timeZone: string;
  }): Date {
    const [hour, minute] = input.startTime.split(':').map((part) => Number(part));

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
      throw new Error(`Invalid startTime '${input.startTime}'.`);
    }

    const localDate = input.localDate ?? this.resolveLocalDateFromWeek(input.weekId, input.dayLabel ?? 'sexta-feira');
    const [year, month, day] = localDate.split('-').map((part) => Number(part));

    return this.weekCalculator.localDateTimeToInstant({
      year,
      month,
      day,
      hour,
      minute,
      timeZone: input.timeZone,
    });
  }

  private resolveLocalDateFromWeek(weekId: string, dayLabel: string): string {
    const dayIndex = DAY_INDEX_BY_LABEL.get(dayLabel.trim().toLowerCase());

    if (dayIndex === undefined) {
      throw new Error(`Unsupported day label '${dayLabel}'.`);
    }

    const range = this.weekCalculator.weekRange(weekId, this.defaultTimeZone);
    const [year, month, day] = range.startDate.split('-').map((part) => Number(part));
    const startDate = new Date(Date.UTC(year, month - 1, day, 12));
    const mondayIndex = 1;
    const delta = dayIndex - mondayIndex;
    startDate.setUTCDate(startDate.getUTCDate() + delta);
    return startDate.toISOString().slice(0, 10);
  }

  private mapEventSummary(
    event: ScheduleEvent,
    fallbackGroupLabel: string | undefined,
    timeZone: string,
  ): WeeklyPlannerEventSummary {
    const localParts = this.weekCalculator.getLocalDateParts(event.eventAt, event.timeZone || timeZone);
    const localDate = `${String(localParts.year).padStart(4, '0')}-${String(localParts.month).padStart(2, '0')}-${String(localParts.day).padStart(2, '0')}`;
    const notifications = event.notifications.reduce(
      (summary, notification) => {
        if (notification.status === 'pending') {
          summary.pending += 1;
        } else if (notification.status === 'waiting_confirmation') {
          summary.waitingConfirmation += 1;
        } else if (notification.status === 'sent') {
          summary.sent += 1;
        }
        summary.total += 1;
        return summary;
      },
      {
        pending: 0,
        waitingConfirmation: 0,
        sent: 0,
        total: 0,
      },
    );

    return {
      eventId: event.eventId,
      weekId: event.weekId,
      groupJid: event.groupJid,
      groupLabel: fallbackGroupLabel ?? event.groupLabel,
      title: event.title,
      eventAt: event.eventAt,
      localDate,
      dayLabel: dayLabelFromDate(localDate),
      startTime: `${String(localParts.hour).padStart(2, '0')}:${String(localParts.minute).padStart(2, '0')}`,
      durationMinutes: readNumericMetadata(event.metadata, 'durationMinutes', 60),
      notes: readStringMetadata(event.metadata, 'notes'),
      notificationRuleLabels: event.notificationRules.map((rule) => rule.label ?? rule.kind),
      notifications,
    };
  }
}

function dayLabelFromDate(localDate: string): string {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  return DAY_LABELS[date.getUTCDay()] ?? 'sexta-feira';
}

function formatWeekRange(range: { readonly startDate: string; readonly endDate: string }): string {
  return `${range.startDate} ate ${range.endDate}`;
}

function readNumericMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
  key: string,
  fallback: number,
): number {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readStringMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : '';
}
