export interface FrontendApiClientAdapterConfig {
  readonly enabled?: boolean;
}

export class FrontendApiClientAdapter {
  constructor(readonly config: FrontendApiClientAdapterConfig = {}) {}

  describe(): Readonly<Record<string, unknown>> {
    return {
      adapter: 'frontend-api-client',
      enabled: this.config.enabled ?? true,
    };
  }
}
