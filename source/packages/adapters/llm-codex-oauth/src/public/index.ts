export interface LlmCodexOauthAdapterConfig {
  readonly enabled?: boolean;
}

export class LlmCodexOauthAdapter {
  constructor(readonly config: LlmCodexOauthAdapterConfig = {}) {}

  describe(): Readonly<Record<string, unknown>> {
    return {
      adapter: 'llm-codex-oauth',
      enabled: this.config.enabled ?? true,
    };
  }
}
