import type { NotificationJob } from '@lume-hub/notification-jobs';

import type { WatchdogIssue, WatchdogIssueKind } from '../entities/WatchdogIssue.js';

export interface WatchdogCollectorConfig {
  readonly overdueGraceMinutes: number;
  readonly waitingConfirmationGraceMinutes: number;
}

export class IssueCollector {
  collect(
    jobs: readonly NotificationJob[],
    now: Date,
    config: WatchdogCollectorConfig,
  ): readonly Omit<WatchdogIssue, 'issueId'>[] {
    return jobs
      .filter((job) => !job.disabledAt && !job.suppressedAt && job.status !== 'sent')
      .flatMap((job) => {
        const issueKind = this.detectIssueKind(job, now, config);

        if (!issueKind) {
          return [];
        }

        return [
          {
            kind: issueKind,
            jobId: job.jobId,
            weekId: job.weekId,
            groupJid: job.groupJid,
            groupLabel: job.groupLabel,
            openedAt: now.toISOString(),
            resolvedAt: null,
            status: 'open' as const,
            summary:
              issueKind === 'job_overdue'
                ? `Job ${job.jobId} passou o limite sem envio confirmado.`
                : `Job ${job.jobId} ficou demasiado tempo em waiting_confirmation.`,
          },
        ];
      });
  }

  private detectIssueKind(
    job: NotificationJob,
    now: Date,
    config: WatchdogCollectorConfig,
  ): WatchdogIssueKind | undefined {
    const sendAt = Date.parse(job.sendAt);
    const elapsedMinutes = (now.getTime() - sendAt) / 60_000;

    if (elapsedMinutes < 0) {
      return undefined;
    }

    if (job.status === 'waiting_confirmation') {
      return elapsedMinutes > config.waitingConfirmationGraceMinutes
        ? 'waiting_confirmation_timeout'
        : undefined;
    }

    return elapsedMinutes > config.overdueGraceMinutes ? 'job_overdue' : undefined;
  }
}
