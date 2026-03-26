import type { LlmModelDescriptor, LlmProvider } from '../entities/LlmOrchestrator.js';

export class LlmProviderRegistry {
  constructor(private readonly providers: readonly LlmProvider[]) {}

  resolve(providerId?: string | null): LlmProvider {
    const provider =
      (providerId ? this.providers.find((candidate) => candidate.providerId === providerId) : undefined) ?? this.providers[0];

    if (!provider) {
      throw new Error('No LLM provider is registered.');
    }

    return provider;
  }

  listModels(): readonly LlmModelDescriptor[] {
    return this.providers.flatMap((provider) => provider.listModels());
  }
}
