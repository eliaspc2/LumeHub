import type { NotificationJob } from '../entities/NotificationJob.js';

export interface NotificationJobQuery {
  readonly groupJid?: string;
  readonly weekId?: string;
}

export interface NotificationJobLookupQuery {
  readonly groupJid?: string;
}

export interface NotificationJobRepository {
  listJobs(query?: NotificationJobQuery): Promise<readonly NotificationJob[]>;
  replaceJobs(
    eventId: string,
    jobs: readonly NotificationJob[],
    query?: NotificationJobLookupQuery,
  ): Promise<readonly NotificationJob[]>;
  updateJob(
    jobId: string,
    mutator: (job: NotificationJob) => NotificationJob,
    query?: NotificationJobLookupQuery,
  ): Promise<NotificationJob | undefined>;
}
