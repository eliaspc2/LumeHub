import { SystemClock, type Clock } from '@lume-hub/clock';
import type { NotificationRuleService } from '@lume-hub/notification-rules';
import type { ScheduleEventService } from '@lume-hub/schedule-events';

import type { NotificationJob } from '../../domain/entities/NotificationJob.js';
import type {
  NotificationJobLookupQuery,
  NotificationJobQuery,
  NotificationJobRepository,
} from '../../domain/repositories/NotificationJobRepository.js';
import { NotificationJobMaterializer } from '../../domain/services/NotificationJobMaterializer.js';

function sortJobs(left: NotificationJob, right: NotificationJob): number {
  return left.sendAt.localeCompare(right.sendAt) || left.jobId.localeCompare(right.jobId);
}

export class NotificationJobService {
  constructor(
    private readonly repository: NotificationJobRepository,
    private readonly notificationRuleService: NotificationRuleService,
    private readonly scheduleEventService: ScheduleEventService,
    private readonly materializer = new NotificationJobMaterializer(),
    private readonly clock: Clock = new SystemClock(),
  ) {}

  async materializeForEvent(
    eventId: string,
    query: NotificationJobLookupQuery = {},
  ): Promise<readonly NotificationJob[]> {
    const event = await this.scheduleEventService.findEventById(eventId, query);

    if (!event) {
      throw new Error(`Event '${eventId}' was not found.`);
    }

    const rules = await this.notificationRuleService.listRulesForEvent(eventId, query);
    return this.repository.replaceJobs(eventId, this.materializer.materialize(event, rules), query);
  }

  async listPendingJobs(query: NotificationJobQuery = {}): Promise<readonly NotificationJob[]> {
    return (await this.repository.listJobs(query))
      .filter(
        (job) =>
          job.status === 'pending' &&
          !job.suppressedAt &&
          !job.disabledAt,
      )
      .sort(sortJobs);
  }

  async markSuppressed(
    jobId: string,
    query: NotificationJobLookupQuery = {},
  ): Promise<NotificationJob | undefined> {
    const now = this.clock.now().toISOString();
    return this.repository.updateJob(
      jobId,
      (job) => ({
        ...job,
        suppressedAt: now,
      }),
      query,
    );
  }

  async markDisabled(
    jobId: string,
    query: NotificationJobLookupQuery = {},
  ): Promise<NotificationJob | undefined> {
    const now = this.clock.now().toISOString();
    return this.repository.updateJob(
      jobId,
      (job) => ({
        ...job,
        disabledAt: now,
      }),
      query,
    );
  }
}
