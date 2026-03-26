import { randomUUID } from 'node:crypto';

import { SystemClock, type Clock } from '@lume-hub/clock';
import type { NotificationJob, NotificationJobRepository } from '@lume-hub/notification-jobs';

import type { WatchdogIssue } from '../../domain/entities/WatchdogIssue.js';
import type {
  WatchdogIssueQuery,
  WatchdogIssueRepository,
} from '../../domain/repositories/WatchdogIssueRepository.js';
import type { IssueNotifier } from '../../domain/services/IssueNotifier.js';
import { IssueCollector, type WatchdogCollectorConfig } from '../../domain/services/IssueCollector.js';

export interface WatchdogTickResult {
  readonly raised: readonly WatchdogIssue[];
  readonly resolved: readonly WatchdogIssue[];
}

export interface WatchdogTickInput extends Partial<WatchdogCollectorConfig> {
  readonly now?: Date;
  readonly groupJid?: string;
}

const DEFAULT_OVERDUE_GRACE_MINUTES = 5;
const DEFAULT_WAITING_CONFIRMATION_GRACE_MINUTES = 15;

export class WatchdogService {
  constructor(
    private readonly notificationJobRepository: NotificationJobRepository,
    private readonly issueRepository: WatchdogIssueRepository,
    private readonly collector: IssueCollector,
    private readonly notifier: IssueNotifier,
    private readonly clock: Clock = new SystemClock(),
    private readonly defaults: WatchdogCollectorConfig = {
      overdueGraceMinutes: DEFAULT_OVERDUE_GRACE_MINUTES,
      waitingConfirmationGraceMinutes: DEFAULT_WAITING_CONFIRMATION_GRACE_MINUTES,
    },
  ) {}

  async tick(input: WatchdogTickInput = {}): Promise<WatchdogTickResult> {
    const now = input.now ?? this.clock.now();
    const config: WatchdogCollectorConfig = {
      overdueGraceMinutes: input.overdueGraceMinutes ?? this.defaults.overdueGraceMinutes,
      waitingConfirmationGraceMinutes:
        input.waitingConfirmationGraceMinutes ?? this.defaults.waitingConfirmationGraceMinutes,
    };
    const jobs = await this.notificationJobRepository.listJobs({
      groupJid: input.groupJid,
    });
    const candidateIssues = this.collector.collect(jobs, now, config);
    const raised: WatchdogIssue[] = [];
    const resolved: WatchdogIssue[] = [];

    for (const candidate of candidateIssues) {
      const existing = await this.issueRepository.readOpenIssue(candidate.kind, candidate.jobId, candidate.groupJid);

      if (existing) {
        continue;
      }

      const createdIssue: WatchdogIssue = {
        issueId: `issue-${randomUUID()}`,
        ...candidate,
      };
      await this.issueRepository.saveIssue(createdIssue);
      await this.notifier.notifyRaised(createdIssue);
      raised.push(createdIssue);
    }

    const openIssues = await this.issueRepository.listIssues({
      groupJid: input.groupJid,
      status: 'open',
    });

    for (const issue of openIssues) {
      const job = jobs.find((candidate) => candidate.jobId === issue.jobId && candidate.groupJid === issue.groupJid);

      if (this.shouldResolve(issue, job, now, config)) {
        const resolvedIssue: WatchdogIssue = {
          ...issue,
          status: 'resolved',
          resolvedAt: now.toISOString(),
        };
        await this.issueRepository.saveIssue(resolvedIssue);
        await this.notifier.notifyResolved(resolvedIssue);
        resolved.push(resolvedIssue);
      }
    }

    return {
      raised,
      resolved,
    };
  }

  async listIssues(query: WatchdogIssueQuery = {}): Promise<readonly WatchdogIssue[]> {
    return this.issueRepository.listIssues(query);
  }

  async resolveIssue(issueId: string): Promise<WatchdogIssue | undefined> {
    const issue = (await this.issueRepository.listIssues()).find((candidate) => candidate.issueId === issueId);

    if (!issue || issue.status === 'resolved') {
      return issue;
    }

    const resolvedIssue: WatchdogIssue = {
      ...issue,
      status: 'resolved',
      resolvedAt: this.clock.now().toISOString(),
    };
    await this.issueRepository.saveIssue(resolvedIssue);
    await this.notifier.notifyResolved(resolvedIssue);
    return resolvedIssue;
  }

  private shouldResolve(
    issue: WatchdogIssue,
    job: NotificationJob | undefined,
    now: Date,
    config: WatchdogCollectorConfig,
  ): boolean {
    if (!job || job.status === 'sent' || job.disabledAt || job.suppressedAt) {
      return true;
    }

    const elapsedMinutes = (now.getTime() - Date.parse(job.sendAt)) / 60_000;

    if (issue.kind === 'waiting_confirmation_timeout') {
      return job.status !== 'waiting_confirmation' || elapsedMinutes <= config.waitingConfirmationGraceMinutes;
    }

    return elapsedMinutes <= config.overdueGraceMinutes;
  }
}
