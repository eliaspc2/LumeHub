export interface DomainEvent<TType extends string = string, TPayload = unknown> {
  readonly type: TType;
  readonly payload: TPayload;
  readonly occurredAt: Date;
}

export type EventMapBase = Record<string, unknown>;

export type EventHandler<TPayload = unknown> = (event: DomainEvent<string, TPayload>) => void | Promise<void>;
export type Unsubscribe = () => void;

export class EventSubscriptionRegistry<TEventMap extends EventMapBase = EventMapBase> {
  private readonly handlers = new Map<keyof TEventMap | string, Set<EventHandler>>();

  subscribe<TKey extends keyof TEventMap & string>(
    type: TKey,
    handler: EventHandler<TEventMap[TKey]>,
  ): Unsubscribe {
    const bucket = this.handlers.get(type) ?? new Set<EventHandler>();
    bucket.add(handler as EventHandler);
    this.handlers.set(type, bucket);

    return () => {
      bucket.delete(handler as EventHandler);

      if (bucket.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  get<TKey extends keyof TEventMap & string>(type: TKey): readonly EventHandler<TEventMap[TKey]>[] {
    return [...(this.handlers.get(type) ?? new Set<EventHandler>())] as readonly EventHandler<TEventMap[TKey]>[];
  }
}

export class InMemoryEventBus<TEventMap extends EventMapBase = EventMapBase> {
  constructor(private readonly registry = new EventSubscriptionRegistry<TEventMap>()) {}

  subscribe<TKey extends keyof TEventMap & string>(
    type: TKey,
    handler: EventHandler<TEventMap[TKey]>,
  ): Unsubscribe {
    return this.registry.subscribe(type, handler);
  }

  async publish<TKey extends keyof TEventMap & string>(
    event: DomainEvent<TKey, TEventMap[TKey]>,
  ): Promise<void> {
    for (const handler of this.registry.get(event.type)) {
      await handler(event);
    }
  }
}

export class DomainEventBus<TEventMap extends EventMapBase = EventMapBase> extends InMemoryEventBus<TEventMap> {}
