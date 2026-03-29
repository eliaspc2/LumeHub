import type { MessageAlertsModuleContract } from '@lume-hub/message-alerts';
import type { NormalizedInboundMessage } from '@lume-hub/whatsapp-baileys';

interface UiEventPublisherLike {
  publish<TPayload>(topic: string, payload: TPayload, now?: Date): {
    readonly eventId: string;
    readonly topic: string;
    readonly emittedAt: string;
    readonly payload: TPayload;
  };
}

interface WhatsAppInboundSourceLike {
  subscribeInbound(listener: (message: NormalizedInboundMessage) => void | Promise<void>): () => void;
}

export interface MessageAlertsRuntimeConfig {
  readonly inboundSource: WhatsAppInboundSourceLike;
  readonly messageAlerts: Pick<MessageAlertsModuleContract, 'handleInbound'>;
  readonly uiEventPublisher?: UiEventPublisherLike;
}

export class MessageAlertsRuntime {
  private started = false;
  private detachInboundListener?: () => void;

  constructor(private readonly config: MessageAlertsRuntimeConfig) {}

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    this.detachInboundListener = this.config.inboundSource.subscribeInbound((message) => {
      void this.handleInbound(message);
    });
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.detachInboundListener?.();
    this.detachInboundListener = undefined;
  }

  private async handleInbound(message: NormalizedInboundMessage): Promise<void> {
    const matches = await this.config.messageAlerts.handleInbound(message);

    for (const match of matches) {
      this.config.uiEventPublisher?.publish('alerts.message.matched', match);
    }
  }
}
