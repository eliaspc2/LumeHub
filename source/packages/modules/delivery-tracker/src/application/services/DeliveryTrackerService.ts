import { randomUUID } from 'node:crypto';

import { SystemClock, type Clock } from '@lume-hub/clock';
import type { NotificationJob, NotificationJobRepository } from '@lume-hub/notification-jobs';

import type {
  DeliveryAttempt,
  OutboundConfirmation,
  OutboundObservation,
  RegisterAttemptStartedInput,
} from '../../domain/entities/DeliveryAttempt.js';
import type {
  DeliveryAttemptLookupQuery,
  DeliveryAttemptRepository,
} from '../../domain/repositories/DeliveryAttemptRepository.js';
import { DeliveryResolutionPolicy } from '../../domain/services/DeliveryResolutionPolicy.js';
import { OutboundSignalReconciler } from '../../domain/services/OutboundSignalReconciler.js';

export interface DeliveryAttemptResolution {
  readonly job: NotificationJob;
  readonly attempt?: DeliveryAttempt;
}

export class DeliveryTrackerService {
  constructor(
    private readonly attemptRepository: DeliveryAttemptRepository,
    private readonly notificationJobRepository: NotificationJobRepository,
    private readonly reconciler = new OutboundSignalReconciler(),
    private readonly resolutionPolicy = new DeliveryResolutionPolicy(),
    private readonly clock: Clock = new SystemClock(),
  ) {}

  async registerAttemptStarted(
    input: RegisterAttemptStartedInput,
    query: DeliveryAttemptLookupQuery = {},
  ): Promise<DeliveryAttempt> {
    const job = await this.readJob(input.jobId, query);

    if (!job) {
      throw new Error(`Notification job '${input.jobId}' was not found.`);
    }

    const startedAt = this.normalizeDate(input.startedAt ?? this.clock.now());
    const attempt: DeliveryAttempt = {
      attemptId: input.attemptId ?? `attempt-${randomUUID()}`,
      jobId: job.jobId,
      eventId: job.eventId,
      weekId: job.weekId,
      groupJid: job.groupJid,
      groupLabel: job.groupLabel,
      messageId: input.messageId,
      startedAt,
      status: 'started',
      lastError: null,
      observation: null,
      confirmation: null,
    };

    const savedAttempt = await this.attemptRepository.saveAttempt(attempt);
    await this.notificationJobRepository.updateJob(
      job.jobId,
      (currentJob) => ({
        ...currentJob,
        status: 'waiting_confirmation',
        attempts: currentJob.attempts + 1,
        lastError: null,
      }),
      {
        groupJid: query.groupJid ?? job.groupJid,
      },
    );

    return savedAttempt;
  }

  async registerObservation(
    observation: Omit<OutboundObservation, 'observedAt'> & { readonly observedAt?: string },
    query: DeliveryAttemptLookupQuery = {},
  ): Promise<DeliveryAttempt | undefined> {
    const currentAttempt = await this.resolveAttemptForSignal({
      jobId: observation.jobId,
      messageId: observation.messageId,
      groupJid: query.groupJid,
    });

    if (!currentAttempt) {
      return undefined;
    }

    const updatedAttempt = await this.attemptRepository.saveAttempt(
      this.reconciler.applyObservation(currentAttempt, {
        ...observation,
        observedAt: this.normalizeDate(observation.observedAt ?? this.clock.now()),
      }),
    );

    await this.resolveAndPersistJob(updatedAttempt.jobId, {
      groupJid: query.groupJid ?? updatedAttempt.groupJid,
    });
    return updatedAttempt;
  }

  async registerConfirmation(
    confirmation: Omit<OutboundConfirmation, 'confirmedAt'> & { readonly confirmedAt?: string },
    query: DeliveryAttemptLookupQuery = {},
  ): Promise<DeliveryAttempt | undefined> {
    const currentAttempt = await this.resolveAttemptForSignal({
      jobId: confirmation.jobId,
      messageId: confirmation.messageId,
      groupJid: query.groupJid,
    });

    if (!currentAttempt) {
      return undefined;
    }

    const updatedAttempt = await this.attemptRepository.saveAttempt(
      this.reconciler.applyConfirmation(currentAttempt, {
        ...confirmation,
        confirmedAt: this.normalizeDate(confirmation.confirmedAt ?? this.clock.now()),
      }),
    );

    await this.resolveAndPersistJob(updatedAttempt.jobId, {
      groupJid: query.groupJid ?? updatedAttempt.groupJid,
    });
    return updatedAttempt;
  }

  async resolvePendingAttempt(
    jobId: string,
    query: DeliveryAttemptLookupQuery = {},
  ): Promise<DeliveryAttemptResolution | undefined> {
    const job = await this.readJob(jobId, query);

    if (!job) {
      return undefined;
    }

    const resolvedJob = await this.resolveAndPersistJob(jobId, {
      groupJid: query.groupJid ?? job.groupJid,
    });
    const latestAttempt = await this.attemptRepository.readLatestAttemptForJob(jobId, {
      groupJid: query.groupJid ?? job.groupJid,
    });

    return {
      job: resolvedJob,
      attempt: latestAttempt,
    };
  }

  private async resolveAndPersistJob(
    jobId: string,
    query: DeliveryAttemptLookupQuery = {},
  ): Promise<NotificationJob> {
    const job = await this.readJob(jobId, query);

    if (!job) {
      throw new Error(`Notification job '${jobId}' was not found.`);
    }

    const attempts = await this.attemptRepository.listAttempts({
      groupJid: query.groupJid ?? job.groupJid,
      jobId,
    });
    const resolvedJob = this.resolutionPolicy.resolve(job, attempts);
    const persisted = await this.notificationJobRepository.updateJob(
      jobId,
      () => resolvedJob,
      {
        groupJid: query.groupJid ?? job.groupJid,
      },
    );

    if (!persisted) {
      throw new Error(`Failed to persist notification job '${jobId}'.`);
    }

    return persisted;
  }

  private async resolveAttemptForSignal(input: {
    readonly jobId?: string;
    readonly messageId: string;
    readonly groupJid?: string;
  }): Promise<DeliveryAttempt | undefined> {
    if (input.jobId) {
      const byJob = await this.attemptRepository.readLatestAttemptForJob(input.jobId, {
        groupJid: input.groupJid,
      });

      if (byJob) {
        return byJob;
      }
    }

    return this.attemptRepository.readAttemptByMessageId(input.messageId, {
      groupJid: input.groupJid,
    });
  }

  private async readJob(jobId: string, query: DeliveryAttemptLookupQuery = {}): Promise<NotificationJob | undefined> {
    return (await this.notificationJobRepository.listJobs({
      groupJid: query.groupJid,
    })).find((job) => job.jobId === jobId);
  }

  private normalizeDate(input: string | Date): string {
    const value = input instanceof Date ? input : new Date(input);

    if (Number.isNaN(value.getTime())) {
      throw new Error(`Invalid date '${String(input)}'.`);
    }

    return value.toISOString();
  }
}
