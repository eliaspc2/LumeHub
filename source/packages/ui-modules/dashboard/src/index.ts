import type { DashboardSnapshot } from '@lume-hub/frontend-api-client';
import type { UiPage } from '@lume-hub/shared-ui';

export interface DashboardUiModuleConfig {
  readonly route: string;
  readonly label: string;
}

export class DashboardUiModule {
  constructor(
    readonly config: DashboardUiModuleConfig = {
      route: '/dashboard',
      label: 'Painel',
    },
  ) {}

  render(snapshot: DashboardSnapshot): UiPage<DashboardSnapshot> {
    return {
      route: this.config.route,
      title: this.config.label,
      description: 'Visao operacional do estado geral, distribuicoes e problemas ativos.',
      sections: [
        {
          title: 'Estado Geral',
          metrics: [
            {
              label: 'Ready',
              value: snapshot.readiness.ready,
              tone: snapshot.readiness.ready ? 'positive' : 'warning',
            },
            {
              label: 'Status',
              value: snapshot.readiness.status,
            },
            {
              label: 'Grupos',
              value: snapshot.groups.total,
            },
            {
              label: 'Problemas ativos',
              value: snapshot.watchdog.openIssues,
              tone: snapshot.watchdog.openIssues > 0 ? 'warning' : 'positive',
            },
          ],
          lines: [
            `Grupos com owner: ${snapshot.groups.withOwners}/${snapshot.groups.total}`,
            `ACL group_owner em read_write: ${snapshot.groups.readWriteGroupOwnerAccess}`,
            `Regras de fan-out: ${snapshot.routing.totalRules} (${snapshot.routing.confirmationRules} com confirmacao)`,
            `Targets declarados: ${snapshot.routing.totalPlannedTargets}`,
          ],
        },
        {
          title: 'Distribuicoes',
          metrics: [
            { label: 'Queued', value: snapshot.distributions.queued },
            { label: 'Running', value: snapshot.distributions.running },
            { label: 'Completed', value: snapshot.distributions.completed, tone: 'positive' },
            { label: 'Partial', value: snapshot.distributions.partialFailed, tone: 'warning' },
            { label: 'Failed', value: snapshot.distributions.failed, tone: 'danger' },
          ],
          lines: [`Total de campanhas/distribuicoes: ${snapshot.distributions.total}`],
        },
        {
          title: 'Health',
          lines: snapshot.health.modules.map(
            (module, index) => `module-${index + 1}: ${module.status}${module.details ? ` ${JSON.stringify(module.details)}` : ''}`,
          ),
        },
      ],
      data: snapshot,
    };
  }
}
