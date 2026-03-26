export type { NotificationJob, NotificationJobStatus } from '../../domain/entities/NotificationJob.js';
export type {
  NotificationJobLookupQuery,
  NotificationJobQuery,
} from '../../domain/repositories/NotificationJobRepository.js';

export interface NotificationJobsModuleContract {
  readonly moduleName: 'notification-jobs';
  materializeForEvent(
    eventId: string,
    query?: import('../../domain/repositories/NotificationJobRepository.js').NotificationJobLookupQuery,
  ): Promise<readonly import('../../domain/entities/NotificationJob.js').NotificationJob[]>;
  listPendingJobs(
    query?: import('../../domain/repositories/NotificationJobRepository.js').NotificationJobQuery,
  ): Promise<readonly import('../../domain/entities/NotificationJob.js').NotificationJob[]>;
  markSuppressed(
    jobId: string,
    query?: import('../../domain/repositories/NotificationJobRepository.js').NotificationJobLookupQuery,
  ): Promise<import('../../domain/entities/NotificationJob.js').NotificationJob | undefined>;
  markDisabled(
    jobId: string,
    query?: import('../../domain/repositories/NotificationJobRepository.js').NotificationJobLookupQuery,
  ): Promise<import('../../domain/entities/NotificationJob.js').NotificationJob | undefined>;
}
