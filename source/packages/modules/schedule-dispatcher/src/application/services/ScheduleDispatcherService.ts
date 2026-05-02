import { SystemClock, type Clock } from '@lume-hub/clock';
import type { DeliveryTrackerService } from '@lume-hub/delivery-tracker';
import type { InstructionQueueModuleContract } from '@lume-hub/instruction-queue';
import type { NotificationJob, NotificationJobRepository } from '@lume-hub/notification-jobs';
import type { DispatchJobResult, DispatchTickResult } from '../../domain/entities/DispatchTickResult.js';
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
    private readonly notificationJobs: Pick<import('@lume-hub/notification-jobs').NotificationJobsModuleContract, 'markPrepared' | 'listJobs'>,
    private readonly deliveryTrackerService: DeliveryTrackerService,
    private readonly instructionQueue: Pick<InstructionQueueModuleContract, 'enqueueInstruction'>,
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
            !job.preparedAt &&
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

    if (
      !currentJob ||
      currentJob.status !== 'pending' ||
      currentJob.preparedAt ||
      currentJob.disabledAt ||
      currentJob.suppressedAt
    ) {
      return {
        jobId: job.jobId,
        status: 'skipped',
        reason: 'job-not-pending',
      };
    }

    const instruction = await this.instructionQueue.enqueueInstruction({
      sourceType: 'notification_reminder',
      sourceMessageId: `${currentJob.jobId}:${currentJob.sendAt}`,
      mode: 'confirmed',
      metadata: {
        queueLabel: currentJob.ruleLabel ?? currentJob.ruleType,
        queueSummary: `${currentJob.groupLabel} · ${currentJob.title} · ${currentJob.ruleLabel ?? currentJob.ruleType}`,
        jobId: currentJob.jobId,
        groupJid: currentJob.groupJid,
      },
      actions: [
        {
          type: 'notification_reminder_delivery',
          dedupeKey: `${currentJob.jobId}:${currentJob.sendAt}`,
          targetGroupJid: currentJob.groupJid,
          payload: {
            kind: 'reminder_delivery',
            jobId: currentJob.jobId,
            eventId: currentJob.eventId,
            ruleId: currentJob.ruleId,
            ruleLabel: currentJob.ruleLabel,
            mediaAssetId: currentJob.mediaAssetId,
            groupJid: currentJob.groupJid,
            groupLabel: currentJob.groupLabel,
            eventTitle: currentJob.title,
            eventAt: currentJob.eventAt,
            sendAt: currentJob.sendAt,
            timeZone: currentJob.timeZone,
            summaryLabel: currentJob.ruleLabel ?? currentJob.ruleType,
            messageTemplate: currentJob.messageTemplate,
            llmPromptTemplate: currentJob.llmPromptTemplate,
          },
        },
      ],
    });
    const preparedAction = instruction.actions[0] ?? null;
    await this.notificationJobs.markPrepared(
      currentJob.jobId,
      {
        preparedAt: this.clock.now().toISOString(),
        preparedInstructionId: instruction.instructionId,
        preparedActionId: preparedAction?.actionId ?? null,
      },
      {
        groupJid: currentJob.groupJid,
      },
    );

    return {
      jobId: currentJob.jobId,
      status: 'prepared',
      instructionId: instruction.instructionId,
    };
  }

  private async readJob(jobId: string, groupJid?: string): Promise<NotificationJob | undefined> {
    return (await this.notificationJobRepository.listJobs({
      groupJid,
    })).find((job) => job.jobId === jobId);
  }
}
