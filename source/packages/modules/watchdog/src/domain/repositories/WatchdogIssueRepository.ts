import type { WatchdogIssue, WatchdogIssueKind } from '../entities/WatchdogIssue.js';

export interface WatchdogIssueQuery {
  readonly groupJid?: string;
  readonly status?: WatchdogIssue['status'];
  readonly kind?: WatchdogIssueKind;
  readonly jobId?: string;
}

export interface WatchdogIssueRepository {
  listIssues(query?: WatchdogIssueQuery): Promise<readonly WatchdogIssue[]>;
  saveIssue(issue: WatchdogIssue): Promise<WatchdogIssue>;
  readOpenIssue(kind: WatchdogIssueKind, jobId: string, groupJid: string): Promise<WatchdogIssue | undefined>;
}
