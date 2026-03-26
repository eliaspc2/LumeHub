export type { WatchdogIssue, WatchdogIssueKind, WatchdogIssueStatus } from '../../domain/entities/WatchdogIssue.js';
export type { WatchdogIssueQuery } from '../../domain/repositories/WatchdogIssueRepository.js';
export type { WatchdogTickInput, WatchdogTickResult } from '../../application/services/WatchdogService.js';

export interface WatchdogModuleContract {
  readonly moduleName: 'watchdog';
  tick(
    input?: import('../../application/services/WatchdogService.js').WatchdogTickInput,
  ): Promise<import('../../application/services/WatchdogService.js').WatchdogTickResult>;
  listIssues(
    query?: import('../../domain/repositories/WatchdogIssueRepository.js').WatchdogIssueQuery,
  ): Promise<readonly import('../../domain/entities/WatchdogIssue.js').WatchdogIssue[]>;
  resolveIssue(issueId: string): Promise<import('../../domain/entities/WatchdogIssue.js').WatchdogIssue | undefined>;
}
