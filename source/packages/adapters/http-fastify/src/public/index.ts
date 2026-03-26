export interface HttpFastifyAdapterConfig {
  readonly enabled?: boolean;
}

export class HttpFastifyAdapter {
  constructor(readonly config: HttpFastifyAdapterConfig = {}) {}

  describe(): Readonly<Record<string, unknown>> {
    return {
      adapter: 'http-fastify',
      enabled: this.config.enabled ?? true,
    };
  }
}
