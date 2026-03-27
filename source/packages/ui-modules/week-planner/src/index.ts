import type { UiPage } from '@lume-hub/shared-ui';

export interface WeekPlannerSnapshot {
  readonly timezone: string;
  readonly focusWeekLabel: string;
  readonly groupsKnown: number;
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
      description: 'Vista semanal orientada a agenda, preparada para ganhar planeamento visual nas waves seguintes.',
      sections: [
        {
          title: 'Estado',
          lines: [
            `Semana em foco: ${snapshot.focusWeekLabel}`,
            `Timezone: ${snapshot.timezone}`,
            `Grupos conhecidos: ${snapshot.groupsKnown}`,
          ],
        },
        {
          title: 'Proximo passo',
          lines: [
            'Nesta wave, a pagina existe para validar a navegacao e a shell visual.',
            'O planeamento detalhado entra na wave seguinte com fluxos mais guiados.',
          ],
        },
      ],
      data: snapshot,
    };
  }
}
