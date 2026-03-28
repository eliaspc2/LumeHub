import type { UiPage } from '@lume-hub/shared-ui';

export interface WeekPlannerSnapshot {
  readonly timezone: string;
  readonly focusWeekLabel: string;
  readonly focusWeekRangeLabel: string;
  readonly groupsKnown: number;
  readonly groups: readonly {
    readonly groupJid: string;
    readonly preferredSubject: string;
    readonly courseId: string | null;
    readonly ownerLabels: readonly string[];
  }[];
  readonly defaultNotificationRuleLabels: readonly string[];
  readonly events: readonly {
    readonly eventId: string;
    readonly weekId: string;
    readonly groupJid: string;
    readonly groupLabel: string;
    readonly title: string;
    readonly eventAt: string;
    readonly localDate: string;
    readonly dayLabel: string;
    readonly startTime: string;
    readonly durationMinutes: number;
    readonly notes: string;
    readonly notificationRuleLabels: readonly string[];
    readonly notifications: {
      readonly pending: number;
      readonly waitingConfirmation: number;
      readonly sent: number;
      readonly total: number;
    };
  }[];
  readonly diagnostics: {
    readonly eventCount: number;
    readonly pendingNotifications: number;
    readonly waitingConfirmationNotifications: number;
    readonly sentNotifications: number;
  };
}

export interface WeekPlannerUiModuleConfig {
  readonly route: string;
  readonly label: string;
}

export class WeekPlannerUiModule {
  constructor(
    readonly config: WeekPlannerUiModuleConfig = {
      route: '/week',
      label: 'Semana',
    },
  ) {}

  render(snapshot: WeekPlannerSnapshot): UiPage<WeekPlannerSnapshot> {
    return {
      route: this.config.route,
      title: this.config.label,
      description: 'Vista semanal live para criar, rever e ajustar agendamentos reais com linguagem humana.',
      sections: [
        {
          title: 'Estado',
          lines: [
            `Semana em foco: ${snapshot.focusWeekLabel}`,
            `Janela: ${snapshot.focusWeekRangeLabel}`,
            `Timezone: ${snapshot.timezone}`,
            `Grupos conhecidos: ${snapshot.groupsKnown}`,
            `Avisos default: ${snapshot.defaultNotificationRuleLabels.join(', ') || 'sem defaults'}`,
          ],
        },
        {
          title: 'Operacao real',
          lines: [
            `Eventos nesta semana: ${snapshot.diagnostics.eventCount}`,
            `Avisos pendentes: ${snapshot.diagnostics.pendingNotifications}`,
            `Aguardam confirmacao: ${snapshot.diagnostics.waitingConfirmationNotifications}`,
            `Avisos enviados: ${snapshot.diagnostics.sentNotifications}`,
          ],
        },
      ],
      data: snapshot,
    };
  }
}
