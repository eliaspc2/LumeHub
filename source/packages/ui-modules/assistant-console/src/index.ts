import type { UiPage } from '@lume-hub/shared-ui';

export interface AssistantConsoleSnapshot {
  readonly provider: string;
  readonly model: string;
  readonly assistantEnabled: boolean;
  readonly directRepliesEnabled: boolean;
}

export interface AssistantConsoleUiModuleConfig {
  readonly route: string;
  readonly label: string;
}

export class AssistantConsoleUiModule {
  constructor(
    readonly config: AssistantConsoleUiModuleConfig = {
      route: '/assistant',
      label: 'Assistente',
    },
  ) {}

  render(snapshot: AssistantConsoleSnapshot): UiPage<AssistantConsoleSnapshot> {
    return {
      route: this.config.route,
      title: this.config.label,
      description: 'Area dedicada ao assistente, pensada para conversas, contexto e acoes sugeridas.',
      sections: [
        {
          title: 'Runtime',
          lines: [
            `Provider: ${snapshot.provider}`,
            `Model: ${snapshot.model}`,
            `Assistente ligado: ${snapshot.assistantEnabled}`,
            `Respostas diretas: ${snapshot.directRepliesEnabled}`,
          ],
        },
        {
          title: 'Proximo passo',
          lines: [
            'Nesta wave, a pagina existe para validar linguagem, navegacao e hierarquia visual.',
            'A consola conversacional completa cresce nas waves seguintes.',
          ],
        },
      ],
      data: snapshot,
    };
  }
}
