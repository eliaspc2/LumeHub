export interface DomainEvent<TPayload = unknown> {
  readonly type: string;
  readonly payload: TPayload;
  readonly occurredAt: Date;
}

export type EventHandler<TPayload = unknown> = (event: DomainEvent<TPayload>) => void | Promise<void>;

export class EventSubscriptionRegistry {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  add<TPayload>(type: string, handler: EventHandler<TPayload>): void {
    const bucket = this.handlers.get(type) ?? new Set<EventHandler>();
    bucket.add(handler as EventHandler);
    this.handlers.set(type, bucket);
  }

  get(type: string): readonly EventHandler[] {
    return [...(this.handlers.get(type) ?? new Set<EventHandler>())];
  }
}

export class InMemoryEventBus {
  constructor(private readonly registry = new EventSubscriptionRegistry()) {}

  subscribe<TPayload>(type: string, handler: EventHandler<TPayload>): void {
    this.registry.add(type, handler);
  }

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    for (const handler of this.registry.get(event.type)) {
      await handler(event);
    }
  }
}

export class DomainEventBus extends InMemoryEventBus {}
