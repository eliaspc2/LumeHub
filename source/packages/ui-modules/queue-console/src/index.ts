import type { DistributionSummary, SenderAudienceRule } from '@lume-hub/frontend-api-client';
import { createListSection, type UiPage } from '@lume-hub/shared-ui';

export interface RoutingConsoleSnapshot {
  readonly rules: readonly SenderAudienceRule[];
  readonly distributions: readonly DistributionSummary[];
}

export interface QueueConsoleUiModuleConfig {
  readonly route: string;
  readonly label: string;
}

export class QueueConsoleUiModule {
  constructor(
    readonly config: QueueConsoleUiModuleConfig = {
      route: '/routing-fanout',
      label: 'Fan-out',
    },
  ) {}

  render(snapshot: RoutingConsoleSnapshot): UiPage<RoutingConsoleSnapshot> {
    return {
      route: this.config.route,
      title: this.config.label,
      description: 'Regras declarativas e distribuicoes por estado.',
      sections: [
        createListSection(
          'Regras',
          snapshot.rules.map(
            (rule) =>
              `${rule.ruleId} | person=${rule.personId ?? 'unknown'} | groups=${rule.targetGroupJids.join(', ') || '-'} | courses=${rule.targetCourseIds.join(', ') || '-'} | disciplines=${rule.targetDisciplineCodes.join(', ') || '-'} | confirmacao=${rule.requiresConfirmation}`,
          ),
          'Sem regras de fan-out.',
        ),
        createListSection(
          'Distribuicoes',
          snapshot.distributions.map(
            (distribution) =>
              `${distribution.instructionId} | status=${distribution.status} | mode=${distribution.mode} | targets=${distribution.targetGroupJids.join(', ') || '-'} | completed=${distribution.actionCounts.completed} | failed=${distribution.actionCounts.failed}`,
          ),
          'Sem distribuicoes conhecidas.',
        ),
      ],
      data: snapshot,
    };
  }
}
