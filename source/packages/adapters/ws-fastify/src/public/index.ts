export interface WsFastifyAdapterConfig {
  readonly enabled?: boolean;
}

export class WsFastifyAdapter {
  constructor(readonly config: WsFastifyAdapterConfig = {}) {}

  describe(): Readonly<Record<string, unknown>> {
    return {
      adapter: 'ws-fastify',
      enabled: this.config.enabled ?? true,
    };
  }
}
