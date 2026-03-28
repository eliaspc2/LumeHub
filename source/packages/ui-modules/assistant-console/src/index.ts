import type { UiPage } from '@lume-hub/shared-ui';

export interface AssistantConsoleSnapshot {
  readonly provider: string;
  readonly model: string;
  readonly assistantEnabled: boolean;
  readonly directRepliesEnabled: boolean;
  readonly availableModels: readonly {
    readonly providerId: string;
    readonly modelId: string;
    readonly label: string;
  }[];
  readonly recentRuns: readonly {
    readonly runId: string;
    readonly operation: string;
    readonly providerId: string;
    readonly modelId: string;
    readonly createdAt: string;
    readonly outputSummary: string;
    readonly memorySummary: string;
  }[];
  readonly recentConversationAudit: readonly {
    readonly auditId: string;
    readonly chatJid: string;
    readonly intent: string | null;
    readonly replyMode: string;
    readonly createdAt: string;
    readonly replyText: string | null;
    readonly memorySummary: string;
  }[];
}

export interface AssistantConsoleUiModuleConfig {
  readonly route: string;
  readonly label: string;
}

export class AssistantConsoleUiModule {
  constructor(
    readonly config: AssistantConsoleUiModuleConfig = {
      route: '/assistant',
      label: 'Assistente',
    },
  ) {}

  render(snapshot: AssistantConsoleSnapshot): UiPage<AssistantConsoleSnapshot> {
    return {
      route: this.config.route,
      title: this.config.label,
      description: 'Area dedicada ao assistente, com provider ativo, modelos e auditoria recente num so sitio.',
      sections: [
        {
          title: 'Runtime',
          lines: [
            `Provider: ${snapshot.provider}`,
            `Model: ${snapshot.model}`,
            `Assistente ligado: ${snapshot.assistantEnabled}`,
            `Respostas diretas: ${snapshot.directRepliesEnabled}`,
          ],
        },
        {
          title: 'Modelos disponiveis',
          lines:
            snapshot.availableModels.length > 0
              ? snapshot.availableModels.map(
                  (model) => `${model.providerId} | ${model.modelId} | ${model.label}`,
                )
              : ['Sem catalogo de modelos visivel.'],
        },
        {
          title: 'Runs LLM recentes',
          lines:
            snapshot.recentRuns.length > 0
              ? snapshot.recentRuns.map(
                  (run) =>
                    `${run.createdAt} | ${run.operation} | ${run.providerId}/${run.modelId} | ${run.memorySummary} | ${run.outputSummary}`,
                )
              : ['Sem runs LLM recentes.'],
        },
        {
          title: 'Auditoria conversacional',
          lines:
            snapshot.recentConversationAudit.length > 0
              ? snapshot.recentConversationAudit.map(
                  (entry) =>
                    `${entry.createdAt} | ${entry.replyMode} | ${entry.intent ?? 'sem intent'} | ${entry.memorySummary} | ${entry.replyText ?? 'sem reply'}`,
                )
              : ['Sem replies auditadas ainda.'],
        },
      ],
      data: snapshot,
    };
  }
}
