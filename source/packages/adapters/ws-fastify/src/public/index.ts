import { randomUUID } from 'node:crypto';

export interface UiEventEnvelope<TPayload = unknown> {
  readonly eventId: string;
  readonly topic: string;
  readonly emittedAt: string;
  readonly payload: TPayload;
}

export interface WebSocketSession {
  readonly sessionId: string;
  close(): void;
}

export type UiEventListener = (event: UiEventEnvelope) => void;

export class WebSocketSessionRegistry {
  private readonly listeners = new Map<string, UiEventListener>();

  register(listener: UiEventListener): WebSocketSession {
    const sessionId = `ws-session-${randomUUID()}`;
    this.listeners.set(sessionId, listener);

    return {
      sessionId,
      close: () => {
        this.listeners.delete(sessionId);
      },
    };
  }

  publish(event: UiEventEnvelope): void {
    for (const listener of this.listeners.values()) {
      listener(event);
    }
  }

  listSessionIds(): readonly string[] {
    return [...this.listeners.keys()];
  }
}

export class UiEventPublisher {
  constructor(private readonly registry: WebSocketSessionRegistry) {}

  publish<TPayload>(topic: string, payload: TPayload, now = new Date()): UiEventEnvelope<TPayload> {
    const event: UiEventEnvelope<TPayload> = {
      eventId: `ui-event-${randomUUID()}`,
      topic: topic.trim(),
      emittedAt: now.toISOString(),
      payload,
    };

    this.registry.publish(event);
    return event;
  }
}

export class WebSocketGateway {
  readonly publisher: UiEventPublisher;

  constructor(readonly registry = new WebSocketSessionRegistry()) {
    this.publisher = new UiEventPublisher(registry);
  }

  connect(listener: UiEventListener): WebSocketSession {
    return this.registry.register(listener);
  }

  subscribe(listener: UiEventListener): () => void {
    const session = this.connect(listener);
    return () => session.close();
  }
}
