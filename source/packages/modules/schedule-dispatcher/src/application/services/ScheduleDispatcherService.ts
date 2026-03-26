import { SystemClock, type Clock } from '@lume-hub/clock';
import type { DeliveryTrackerService } from '@lume-hub/delivery-tracker';
import type { NotificationJob, NotificationJobRepository } from '@lume-hub/notification-jobs';
import type { IWhatsAppGateway } from '@lume-hub/whatsapp-baileys';

import type { DispatchJobResult, DispatchTickResult } from '../../domain/entities/DispatchTickResult.js';
import { DispatchMessageFormatter } from '../../domain/services/DispatchMessageFormatter.js';
import { TickSerialiser } from '../../domain/services/TickSerialiser.js';

export interface ScheduleDispatcherTickInput {
  readonly now?: Date;
  readonly groupJid?: string;
  readonly limit?: number;
}

function sortJobs(left: NotificationJob, right: NotificationJob): number {
  return left.sendAt.localeCompare(right.sendAt) || left.jobId.localeCompare(right.jobId);
}

export class ScheduleDispatcherService {
  constructor(
    private readonly notificationJobRepository: NotificationJobRepository,
    private readonly deliveryTrackerService: DeliveryTrackerService,
    private readonly gateway: IWhatsAppGateway,
    private readonly formatter = new DispatchMessageFormatter(),
    private readonly clock: Clock = new SystemClock(),
    private readonly tickSerialiser = new TickSerialiser(),
  ) {}

  async tick(input: ScheduleDispatcherTickInput = {}): Promise<DispatchTickResult> {
    return this.tickSerialiser.runExclusive(async () => {
      const now = input.now ?? this.clock.now();
      const startedAt = this.clock.now().toISOString();
      const jobs = await this.notificationJobRepository.listJobs({
        groupJid: input.groupJid,
      });
      const waitingConfirmationJobs = jobs
        .filter((job) => job.status === 'waiting_confirmation' && !job.suppressedAt && !job.disabledAt)
        .sort(sortJobs);

      for (const job of waitingConfirmationJobs) {
        await this.deliveryTrackerService.resolvePendingAttempt(job.jobId, {
          groupJid: job.groupJid,
        });
      }

      const currentJobs = await this.notificationJobRepository.listJobs({
        groupJid: input.groupJid,
      });
      const duePendingJobs = currentJobs
        .filter(
          (job) =>
            job.status === 'pending' &&
            !job.suppressedAt &&
            !job.disabledAt &&
            Date.parse(job.sendAt) <= now.getTime(),
        )
        .sort(sortJobs)
        .slice(0, input.limit ?? Number.POSITIVE_INFINITY);
      const results: DispatchJobResult[] = [];

      for (const job of duePendingJobs) {
        results.push(await this.dispatchJob(job));
      }

      for (const job of waitingConfirmationJobs) {
        results.push({
          jobId: job.jobId,
          status: 'waiting_confirmation_reviewed',
        });
      }

      return {
        tickStartedAt: startedAt,
        tickFinishedAt: this.clock.now().toISOString(),
        dueJobsScanned: duePendingJobs.length,
        waitingConfirmationReviewed: waitingConfirmationJobs.length,
        results,
      };
    });
  }

  private async dispatchJob(job: NotificationJob): Promise<DispatchJobResult> {
    const currentJob = await this.readJob(job.jobId, job.groupJid);

    if (!currentJob || currentJob.status !== 'pending' || currentJob.disabledAt || currentJob.suppressedAt) {
      return {
        jobId: job.jobId,
        status: 'skipped',
        reason: 'job-not-pending',
      };
    }

    if (currentJob.attempts > 0 || currentJob.lastOutboundObservationAt) {
      await this.deliveryTrackerService.resolvePendingAttempt(currentJob.jobId, {
        groupJid: currentJob.groupJid,
      });
      const resolvedJob = await this.readJob(currentJob.jobId, currentJob.groupJid);

      if (!resolvedJob || resolvedJob.status !== 'pending') {
        return {
          jobId: currentJob.jobId,
          status: 'skipped',
          reason: 'job-already-in-flight',
        };
      }
    }

    const sendResult = await this.gateway.sendText({
      chatJid: currentJob.groupJid,
      text: this.formatter.format(currentJob),
      idempotencyKey: currentJob.jobId,
    });

    await this.deliveryTrackerService.registerAttemptStarted(
      {
        jobId: currentJob.jobId,
        messageId: sendResult.messageId,
      },
      {
        groupJid: currentJob.groupJid,
      },
    );

    return {
      jobId: currentJob.jobId,
      status: 'started',
      messageId: sendResult.messageId,
    };
  }

  private async readJob(jobId: string, groupJid?: string): Promise<NotificationJob | undefined> {
    return (await this.notificationJobRepository.listJobs({
      groupJid,
    })).find((job) => job.jobId === jobId);
  }
}
