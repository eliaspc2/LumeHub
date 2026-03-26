import type { WatchdogIssue } from '@lume-hub/frontend-api-client';
import { createListSection, type UiPage } from '@lume-hub/shared-ui';

export interface WatchdogInboxUiModuleConfig {
  readonly route: string;
  readonly label: string;
}

export class WatchdogInboxUiModule {
  constructor(
    readonly config: WatchdogInboxUiModuleConfig = {
      route: '/watchdog',
      label: 'Watchdog',
    },
  ) {}

  render(issues: readonly WatchdogIssue[]): UiPage<readonly WatchdogIssue[]> {
    return {
      route: this.config.route,
      title: this.config.label,
      description: 'Inbox operacional de problemas ativos e historico recente.',
      sections: [
        createListSection(
          'Issues',
          issues.map(
            (issue) =>
              `${issue.issueId} | ${issue.kind} | ${issue.status} | ${issue.groupLabel} | ${issue.summary}`,
          ),
          'Sem problemas ativos.',
        ),
      ],
      data: issues,
    };
  }
}
