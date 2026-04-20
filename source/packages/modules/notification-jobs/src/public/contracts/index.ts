export type { NotificationJob, NotificationJobStatus } from '../../domain/entities/NotificationJob.js';
export type {
  NotificationJobLookupQuery,
  NotificationJobQuery,
} from '../../domain/repositories/NotificationJobRepository.js';
export type {
  NotificationJobCleanupInput,
  NotificationJobCleanupResult,
} from '../../application/services/NotificationJobCleanupService.js';

export interface NotificationJobsModuleContract {
  readonly moduleName: 'notification-jobs';
  materializeForEvent(
    eventId: string,
    query?: import('../../domain/repositories/NotificationJobRepository.js').NotificationJobLookupQuery,
  ): Promise<readonly import('../../domain/entities/NotificationJob.js').NotificationJob[]>;
  listPendingJobs(
    query?: import('../../domain/repositories/NotificationJobRepository.js').NotificationJobQuery,
  ): Promise<readonly import('../../domain/entities/NotificationJob.js').NotificationJob[]>;
  listJobs(
    query?: import('../../domain/repositories/NotificationJobRepository.js').NotificationJobQuery,
  ): Promise<readonly import('../../domain/entities/NotificationJob.js').NotificationJob[]>;
  markPrepared(
    jobId: string,
    input: {
      readonly preparedAt?: string;
      readonly preparedInstructionId?: string | null;
      readonly preparedActionId?: string | null;
    },
    query?: import('../../domain/repositories/NotificationJobRepository.js').NotificationJobLookupQuery,
  ): Promise<import('../../domain/entities/NotificationJob.js').NotificationJob | undefined>;
  markSuppressed(
    jobId: string,
    query?: import('../../domain/repositories/NotificationJobRepository.js').NotificationJobLookupQuery,
  ): Promise<import('../../domain/entities/NotificationJob.js').NotificationJob | undefined>;
  markDisabled(
    jobId: string,
    query?: import('../../domain/repositories/NotificationJobRepository.js').NotificationJobLookupQuery,
  ): Promise<import('../../domain/entities/NotificationJob.js').NotificationJob | undefined>;
  cleanupPastEvents(
    input?: import('../../application/services/NotificationJobCleanupService.js').NotificationJobCleanupInput,
  ): Promise<import('../../application/services/NotificationJobCleanupService.js').NotificationJobCleanupResult>;
}
