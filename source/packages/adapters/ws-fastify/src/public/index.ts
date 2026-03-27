import { randomUUID } from 'node:crypto';
import type { Server as NodeHttpServer } from 'node:http';

import { WebSocketServer, type WebSocket } from 'ws';

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

export interface WebSocketAttachOptions {
  readonly path?: string;
}

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
  private webSocketServer?: WebSocketServer;
  private attachPath = '/ws';

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

  attach(server: NodeHttpServer, options: WebSocketAttachOptions = {}): void {
    if (this.webSocketServer) {
      return;
    }

    this.attachPath = normaliseAttachPath(options.path);
    this.webSocketServer = new WebSocketServer({
      server,
      path: this.attachPath,
    });
    this.webSocketServer.on('error', () => {
      // Startup failures still surface through the HTTP server; this avoids an unhandled event crash.
    });

    this.webSocketServer.on('connection', (socket: WebSocket) => {
      const session = this.connect((event) => {
        if (socket.readyState !== socket.OPEN) {
          return;
        }

        socket.send(JSON.stringify(event));
      });

      const closeSession = () => {
        session.close();
      };

      socket.on('close', closeSession);
      socket.on('error', closeSession);
    });
  }

  async close(): Promise<void> {
    if (!this.webSocketServer) {
      return;
    }

    const server = this.webSocketServer;
    this.webSocketServer = undefined;

    for (const client of server.clients) {
      safeTerminate(client);
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  getPath(): string {
    return this.attachPath;
  }
}

function normaliseAttachPath(path = '/ws'): string {
  const trimmed = path.trim();

  if (!trimmed) {
    return '/ws';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function safeTerminate(socket: WebSocket): void {
  try {
    socket.terminate();
  } catch {}
}
