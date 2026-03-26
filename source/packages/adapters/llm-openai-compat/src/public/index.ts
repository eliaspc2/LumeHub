export interface LlmOpenaiCompatAdapterConfig {
  readonly enabled?: boolean;
}

export class LlmOpenaiCompatAdapter {
  constructor(readonly config: LlmOpenaiCompatAdapterConfig = {}) {}

  describe(): Readonly<Record<string, unknown>> {
    return {
      adapter: 'llm-openai-compat',
      enabled: this.config.enabled ?? true,
    };
  }
}
