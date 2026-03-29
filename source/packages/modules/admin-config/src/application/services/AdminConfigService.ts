import type {
  AdminSettings,
  CommandsPolicySettings,
  LlmProviderReadinessSnapshot,
  LlmRuntimeSettings,
  LlmRuntimeStatusInput,
  LlmRuntimeStatusSnapshot,
  UiSettings,
  WhatsAppSettings,
} from '../../domain/entities/AdminConfig.js';
import { DEFAULT_ADMIN_SETTINGS } from '../../domain/entities/AdminConfig.js';
import { AdminConfigRepository } from '../../infrastructure/persistence/AdminConfigRepository.js';

export class AdminConfigService {
  constructor(private readonly repository: AdminConfigRepository) {}

  async getSettings(): Promise<AdminSettings> {
    return this.repository.readSettings();
  }

  async updateCommandsSettings(
    update: Partial<CommandsPolicySettings>,
    now = new Date(),
  ): Promise<AdminSettings> {
    const current = await this.getSettings();
    return this.repository.saveSettings({
      ...current,
      commands: mergeDefined(current.commands, update),
      updatedAt: now.toISOString(),
    });
  }

  async updateLlmSettings(update: Partial<LlmRuntimeSettings>, now = new Date()): Promise<AdminSettings> {
    const current = await this.getSettings();
    return this.repository.saveSettings({
      ...current,
      llm: {
        ...current.llm,
        ...update,
      },
      updatedAt: now.toISOString(),
    });
  }

  async updateWhatsAppSettings(update: Partial<WhatsAppSettings>, now = new Date()): Promise<AdminSettings> {
    const current = await this.getSettings();
    return this.repository.saveSettings({
      ...current,
      whatsapp: mergeDefined(current.whatsapp, update),
      updatedAt: now.toISOString(),
    });
  }

  async updateUiSettings(update: Partial<UiSettings>, now = new Date()): Promise<AdminSettings> {
    const current = await this.getSettings();
    return this.repository.saveSettings({
      ...current,
      ui: {
        ...current.ui,
        ...update,
        defaultNotificationRules: update.defaultNotificationRules ?? current.ui.defaultNotificationRules,
      },
      updatedAt: now.toISOString(),
    });
  }

  async getLlmRuntimeStatus(input: LlmRuntimeStatusInput = {}): Promise<LlmRuntimeStatusSnapshot> {
    const current = await this.getSettings();
    return resolveLlmRuntimeStatus(current, input);
  }
}

function mergeDefined<T extends object>(current: T, update: Partial<T>): T {
  const nextEntries = Object.entries(update).filter(([, value]) => value !== undefined);
  return {
    ...current,
    ...Object.fromEntries(nextEntries),
  } as T;
}

function resolveLlmRuntimeStatus(
  settings: AdminSettings,
  input: LlmRuntimeStatusInput,
): LlmRuntimeStatusSnapshot {
  const configuredProviderId = settings.llm.provider.trim() || DEFAULT_ADMIN_SETTINGS.llm.provider;
  const configuredModelId = settings.llm.model.trim() || DEFAULT_ADMIN_SETTINGS.llm.model;
  const fallbackProviderId = input.fallbackProviderId?.trim() || 'local-deterministic';
  const fallbackModelId = input.fallbackModelId?.trim() || 'lume-context-v1';
  const providerReadiness = buildProviderReadiness(input);

  if (!settings.llm.enabled) {
    return {
      configuredEnabled: false,
      configuredProviderId,
      configuredModelId,
      effectiveProviderId: fallbackProviderId,
      effectiveModelId: fallbackModelId,
      mode: 'disabled',
      fallbackActive: false,
      fallbackReason: 'LLM live desativada na configuracao atual.',
      providerReadiness,
    };
  }

  const readiness = providerReadiness.find((candidate) => candidate.providerId === configuredProviderId);
  const providerReady = readiness ? readiness.ready : true;

  if (providerReady) {
    return {
      configuredEnabled: true,
      configuredProviderId,
      configuredModelId,
      effectiveProviderId: configuredProviderId,
      effectiveModelId: configuredModelId,
      mode: 'live',
      fallbackActive: false,
      fallbackReason: null,
      providerReadiness,
    };
  }

  return {
    configuredEnabled: true,
    configuredProviderId,
    configuredModelId,
    effectiveProviderId: fallbackProviderId,
    effectiveModelId: fallbackModelId,
    mode: 'fallback',
    fallbackActive: true,
    fallbackReason: readiness?.reason ?? `O provider '${configuredProviderId}' ainda nao esta pronto.`,
    providerReadiness,
  };
}

function buildProviderReadiness(input: LlmRuntimeStatusInput): readonly LlmProviderReadinessSnapshot[] {
  return [
    {
      providerId: 'codex-oauth',
      label: 'Codex OAuth',
      ready: input.codexAuthReady ?? false,
      reason: input.codexAuthReady ?? false ? null : 'Auth live do Codex ainda nao esta pronta.',
    },
    {
      providerId: 'openai-compat',
      label: 'OpenAI compat',
      ready: input.openAiCompatReady ?? false,
      reason: input.openAiCompatReady ?? false ? null : 'API key do provider compativel ainda nao esta disponivel.',
    },
  ];
}
