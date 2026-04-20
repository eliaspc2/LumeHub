import type { NotificationRule } from '@lume-hub/notification-rules';
import { WeekCalculator } from '@lume-hub/schedule-weeks';
import type { ScheduleEvent } from '@lume-hub/schedule-events';

import type { NotificationJob } from '../entities/NotificationJob.js';

function sortJobs(left: NotificationJob, right: NotificationJob): number {
  return left.sendAt.localeCompare(right.sendAt) || left.jobId.localeCompare(right.jobId);
}

export class NotificationJobMaterializer {
  constructor(private readonly weekCalculator = new WeekCalculator()) {}

  materialize(event: ScheduleEvent, rules: readonly NotificationRule[]): readonly NotificationJob[] {
    return rules
      .filter((rule) => rule.enabled)
      .map((rule) => ({
        jobId: `job-${event.eventId}-${rule.ruleId}`,
        eventId: event.eventId,
        ruleId: rule.ruleId,
        weekId: event.weekId,
        groupJid: event.groupJid,
        groupLabel: event.groupLabel,
        title: event.title,
        kind: event.kind,
        eventAt: event.eventAt,
        timeZone: event.timeZone,
        ruleType: rule.kind,
        ruleLabel: rule.label ?? rule.kind,
        messageTemplate: rule.messageTemplate ?? null,
        llmPromptTemplate: rule.llmPromptTemplate ?? null,
        sendAt: this.resolveSendAt(event, rule),
        status: 'pending' as const,
        preparedAt: null,
        preparedInstructionId: null,
        preparedActionId: null,
        attempts: 0,
        lastError: null,
        lastOutboundObservationAt: null,
        confirmedAt: null,
        suppressedAt: null,
        disabledAt: null,
      }))
      .sort(sortJobs);
  }

  private resolveSendAt(event: ScheduleEvent, rule: NotificationRule): string {
    if (rule.kind === 'relative_before_event') {
      const eventAt = new Date(event.eventAt);
      return new Date(eventAt.getTime() - ((rule.offsetMinutesBeforeEvent ?? 0) * 60_000)).toISOString();
    }

    if (rule.kind === 'relative_after_event') {
      const eventAt = new Date(event.eventAt);
      return new Date(eventAt.getTime() + ((rule.offsetMinutesAfterEvent ?? 0) * 60_000)).toISOString();
    }

    const eventLocalDate = this.weekCalculator.getLocalDateParts(event.eventAt, event.timeZone);
    const fixedDate = this.weekCalculator.shiftLocalDate(
      {
        year: eventLocalDate.year,
        month: eventLocalDate.month,
        day: eventLocalDate.day,
      },
      -(rule.daysBeforeEvent ?? 0),
    );
    const [hour, minute] = (rule.localTime ?? '00:00').split(':').map((value) => Number(value));

    return this.weekCalculator
      .localDateTimeToInstant({
        year: fixedDate.year,
        month: fixedDate.month,
        day: fixedDate.day,
        hour,
        minute,
        timeZone: event.timeZone,
      })
      .toISOString();
  }
}
