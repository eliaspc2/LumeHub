import type {
  LlmModelCatalogRefreshResult,
  LlmModelDescriptor,
  LlmProvider,
  LlmRefreshableProvider,
} from '../entities/LlmOrchestrator.js';

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

  async refreshModels(providerId?: string | null): Promise<readonly LlmModelCatalogRefreshResult[]> {
    const targetProviders = providerId
      ? this.providers.filter((provider) => provider.providerId === providerId)
      : this.providers;

    const refreshableProviders = targetProviders.filter(isRefreshableProvider);
    return Promise.all(refreshableProviders.map((provider) => provider.refreshModels()));
  }
}

function isRefreshableProvider(provider: LlmProvider): provider is LlmRefreshableProvider {
  return typeof (provider as Partial<LlmRefreshableProvider>).refreshModels === 'function';
}
