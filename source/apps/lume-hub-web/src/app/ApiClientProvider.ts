import {
  FrontendApiClient,
  type FrontendApiTransport,
  type FrontendUiEvent,
} from '@lume-hub/frontend-api-client';

export interface ApiClientProviderConfig {
  readonly transport?: FrontendApiTransport;
}

export class ApiClientProvider {
  readonly client: FrontendApiClient;
  private readonly liveEvents: FrontendUiEvent[] = [];

  constructor(readonly config: ApiClientProviderConfig = {}) {
    this.client = new FrontendApiClient(config.transport ?? new UnavailableFrontendApiTransport());
    this.client.subscribe((event) => {
      this.liveEvents.push(event);

      if (this.liveEvents.length > 20) {
        this.liveEvents.shift();
      }
    });
  }

  getClient(): FrontendApiClient {
    return this.client;
  }

  getBufferedEvents(): readonly FrontendUiEvent[] {
    return [...this.liveEvents];
  }

  describe(): string {
    return this.config.transport ? 'frontend api client connected' : 'frontend api client awaiting transport';
  }
}

class UnavailableFrontendApiTransport implements FrontendApiTransport {
  async request<T = unknown>(): Promise<{ statusCode: number; body: T }> {
    return {
      statusCode: 503,
      body: {
        error: 'Frontend transport not configured.',
      } as T,
    };
  }
}
