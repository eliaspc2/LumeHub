import type { ScheduleEventRepository, ScheduleEventService } from '@lume-hub/schedule-events';

import type { NotificationJob } from '../../domain/entities/NotificationJob.js';
import type {
  NotificationJobLookupQuery,
  NotificationJobQuery,
  NotificationJobRepository,
} from '../../domain/repositories/NotificationJobRepository.js';

function sortJobs(left: NotificationJob, right: NotificationJob): number {
  return left.sendAt.localeCompare(right.sendAt) || left.jobId.localeCompare(right.jobId);
}

export class CalendarBackedNotificationJobRepository implements NotificationJobRepository {
  constructor(
    private readonly scheduleEventService: ScheduleEventService,
    private readonly scheduleEventRepository: ScheduleEventRepository,
  ) {}

  async listJobs(query: NotificationJobQuery = {}): Promise<readonly NotificationJob[]> {
    const events = await this.scheduleEventRepository.listEvents(query);

    return events
      .flatMap((event) =>
        event.notifications.map((notification) => ({
          jobId: notification.jobId,
          eventId: event.eventId,
          ruleId: notification.ruleId,
          weekId: notification.weekId,
          groupJid: event.groupJid,
          groupLabel: event.groupLabel,
          title: event.title,
          kind: event.kind,
          eventAt: event.eventAt,
          timeZone: event.timeZone,
          ruleType: notification.ruleType,
          sendAt: notification.sendAt,
          status: notification.status,
          attempts: notification.attempts,
          lastError: notification.lastError,
          lastOutboundObservationAt: notification.lastOutboundObservationAt,
          confirmedAt: notification.confirmedAt,
          suppressedAt: notification.suppressedAt ?? null,
          disabledAt: notification.disabledAt ?? null,
        })),
      )
      .sort(sortJobs);
  }

  async replaceJobs(
    eventId: string,
    jobs: readonly NotificationJob[],
    query: NotificationJobLookupQuery = {},
  ): Promise<readonly NotificationJob[]> {
    const updatedEvent = await this.scheduleEventService.updateEvent(
      eventId,
      {
        notifications: jobs.map((job) => ({
          jobId: job.jobId,
          ruleId: job.ruleId,
          weekId: job.weekId,
          ruleType: job.ruleType,
          sendAt: job.sendAt,
          status: job.status,
          attempts: job.attempts,
          lastError: job.lastError,
          lastOutboundObservationAt: job.lastOutboundObservationAt,
          confirmedAt: job.confirmedAt,
          suppressedAt: job.suppressedAt ?? null,
          disabledAt: job.disabledAt ?? null,
        })),
      },
      query,
    );

    return updatedEvent.notifications.map((notification) => ({
      jobId: notification.jobId,
      eventId: updatedEvent.eventId,
      ruleId: notification.ruleId,
      weekId: notification.weekId,
      groupJid: updatedEvent.groupJid,
      groupLabel: updatedEvent.groupLabel,
      title: updatedEvent.title,
      kind: updatedEvent.kind,
      eventAt: updatedEvent.eventAt,
      timeZone: updatedEvent.timeZone,
      ruleType: notification.ruleType,
      sendAt: notification.sendAt,
      status: notification.status,
      attempts: notification.attempts,
      lastError: notification.lastError,
      lastOutboundObservationAt: notification.lastOutboundObservationAt,
      confirmedAt: notification.confirmedAt,
      suppressedAt: notification.suppressedAt ?? null,
      disabledAt: notification.disabledAt ?? null,
    }));
  }

  async updateJob(
    jobId: string,
    mutator: (job: NotificationJob) => NotificationJob,
    query: NotificationJobLookupQuery = {},
  ): Promise<NotificationJob | undefined> {
    const jobs = await this.listJobs(query);
    const targetJob = jobs.find((job) => job.jobId === jobId);

    if (!targetJob) {
      return undefined;
    }

    const updatedJob = mutator(targetJob);
    const event = await this.scheduleEventService.findEventById(targetJob.eventId, {
      groupJid: targetJob.groupJid,
    });

    if (!event) {
      return undefined;
    }

    const updatedNotifications = event.notifications.map((notification) =>
      notification.jobId === jobId
        ? {
            jobId: updatedJob.jobId,
            ruleId: updatedJob.ruleId,
            weekId: updatedJob.weekId,
            ruleType: updatedJob.ruleType,
            sendAt: updatedJob.sendAt,
            status: updatedJob.status,
            attempts: updatedJob.attempts,
            lastError: updatedJob.lastError,
            lastOutboundObservationAt: updatedJob.lastOutboundObservationAt,
            confirmedAt: updatedJob.confirmedAt,
            suppressedAt: updatedJob.suppressedAt ?? null,
            disabledAt: updatedJob.disabledAt ?? null,
          }
        : notification,
    );

    await this.scheduleEventService.updateEvent(
      event.eventId,
      {
        notifications: updatedNotifications,
      },
      {
        groupJid: query.groupJid ?? event.groupJid,
      },
    );

    return updatedJob;
  }
}
