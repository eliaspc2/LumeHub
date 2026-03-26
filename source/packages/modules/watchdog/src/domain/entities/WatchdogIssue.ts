export type WatchdogIssueKind = 'job_overdue' | 'waiting_confirmation_timeout';
export type WatchdogIssueStatus = 'open' | 'resolved';

export interface WatchdogIssue {
  readonly issueId: string;
  readonly kind: WatchdogIssueKind;
  readonly jobId: string;
  readonly weekId: string;
  readonly groupJid: string;
  readonly groupLabel: string;
  readonly openedAt: string;
  readonly resolvedAt?: string | null;
  readonly status: WatchdogIssueStatus;
  readonly summary: string;
}
