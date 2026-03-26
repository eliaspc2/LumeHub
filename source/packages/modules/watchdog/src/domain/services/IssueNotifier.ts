import type { WatchdogIssue } from '../entities/WatchdogIssue.js';

export interface IssueNotifier {
  notifyRaised(issue: WatchdogIssue): Promise<void>;
  notifyResolved(issue: WatchdogIssue): Promise<void>;
}

export class NoopIssueNotifier implements IssueNotifier {
  async notifyRaised(_issue: WatchdogIssue): Promise<void> {}

  async notifyResolved(_issue: WatchdogIssue): Promise<void> {}
}
