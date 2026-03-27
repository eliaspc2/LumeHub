import type { UiPage } from '@lume-hub/shared-ui';

export interface DeliveryMonitorSnapshot {
  readonly pending: number;
  readonly waitingConfirmation: number;
  readonly sent: number;
  readonly openIssues: number;
}

export interface DeliveryMonitorUiModuleConfig {
  readonly route: string;
  readonly label: string;
}

export class DeliveryMonitorUiModule {
  constructor(
    readonly config: DeliveryMonitorUiModuleConfig = {
      route: '/deliveries',
      label: 'Entregas',
    },
  ) {}

  render(snapshot: DeliveryMonitorSnapshot): UiPage<DeliveryMonitorSnapshot> {
    return {
      route: this.config.route,
      title: this.config.label,
      description: 'Vista dedicada ao ciclo de entrega, confirmacoes e problemas operacionais.',
      sections: [
        {
          title: 'Fila',
          lines: [
            `Pendentes: ${snapshot.pending}`,
            `A espera de confirmacao: ${snapshot.waitingConfirmation}`,
            `Confirmadas/enviadas: ${snapshot.sent}`,
            `Issues abertas: ${snapshot.openIssues}`,
          ],
        },
        {
          title: 'Proximo passo',
          lines: [
            'Nesta wave, a pagina existe para testar a shell e reservar espaco para a monitorizacao detalhada.',
            'A timeline operacional entra mais a fundo nas waves seguintes.',
          ],
        },
      ],
      data: snapshot,
    };
  }
}
