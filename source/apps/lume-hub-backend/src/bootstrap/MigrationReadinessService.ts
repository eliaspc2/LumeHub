import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { AdminSettings, LlmRuntimeStatusSnapshot } from '@lume-hub/admin-config';
import type { ConversationAuditRecord } from '@lume-hub/conversation';
import type { LlmRunLogEntry } from '@lume-hub/llm-orchestrator';
import type { LegacyScheduleImportFileSummary } from '@lume-hub/weekly-planner';
import type { WhatsAppRuntimeSnapshot } from '@lume-hub/whatsapp-baileys';

import type { BackendRuntimeDiagnosticsState } from './BackendRuntimeStateRepository.js';
import type { BackendRuntimePaths } from './BackendRuntimeConfig.js';

export interface MigrationReadinessChecklistItemSnapshot {
  readonly itemId: string;
  readonly label: string;
  readonly status: 'ready' | 'review' | 'blocked';
  readonly summary: string;
}

export interface MigrationReadinessSnapshot {
  readonly generatedAt: string;
  readonly recommendedPhase: 'blocked' | 'shadow_mode';
  readonly cutoverDecisionReady: boolean;
  readonly summary: string;
  readonly runtime: {
    readonly phase: BackendRuntimeDiagnosticsState['phase'];
    readonly ready: boolean;
    readonly lastTickAt: string | null;
    readonly lastError: string | null;
  };
  readonly llm: {
    readonly configuredProvider: string;
    readonly effectiveProvider: string;
    readonly effectiveModel: string;
    readonly mode: LlmRuntimeStatusSnapshot['mode'];
    readonly codexAuthReady: boolean;
    readonly fallbackReason: string | null;
  };
  readonly whatsapp: {
    readonly phase: WhatsAppRuntimeSnapshot['session']['phase'];
    readonly connected: boolean;
    readonly loginRequired: boolean;
    readonly discoveredGroups: number;
    readonly discoveredConversations: number;
  };
  readonly legacySources: {
    readonly schedulesRootPath: string;
    readonly scheduleFileCount: number;
    readonly alertsFilePath: string;
    readonly alertsFilePresent: boolean;
    readonly automationsFilePath: string;
    readonly automationsFilePresent: boolean;
  };
  readonly lumeHubState: {
    readonly knownGroups: number;
    readonly importedScheduleEvents: number;
    readonly alertRules: number;
    readonly automationDefinitions: number;
    readonly llmRunCount: number;
    readonly conversationAuditCount: number;
  };
  readonly checklist: readonly MigrationReadinessChecklistItemSnapshot[];
  readonly blockers: readonly string[];
  readonly comparison: readonly {
    readonly label: string;
    readonly tone: 'positive' | 'warning' | 'neutral';
    readonly waNotify: string;
    readonly lumeHub: string;
  }[];
  readonly shadowModeChecks: readonly string[];
  readonly cutoverChecks: readonly string[];
}

export interface MigrationReadinessServiceConfig {
  readonly paths: Pick<
    BackendRuntimePaths,
    'dataRootPath' | 'waNotifyAlertsFilePath' | 'waNotifyAutomationsFilePath' | 'waNotifySchedulesRootPath'
  >;
  readDiagnostics(): Promise<BackendRuntimeDiagnosticsState>;
  readSettings(): Promise<AdminSettings>;
  readLlmRuntimeStatus(): Promise<LlmRuntimeStatusSnapshot>;
  listGroups(): Promise<readonly { readonly groupJid: string }[]>;
  listLegacyScheduleFiles(): Promise<readonly LegacyScheduleImportFileSummary[]>;
  readWhatsAppRuntime(): Promise<WhatsAppRuntimeSnapshot>;
  readLlmLogs(limit?: number): Promise<readonly LlmRunLogEntry[]>;
  readConversationAudit(limit?: number): Promise<readonly ConversationAuditRecord[]>;
}

export class MigrationReadinessService {
  constructor(private readonly config: MigrationReadinessServiceConfig) {}

  async getSnapshot(): Promise<MigrationReadinessSnapshot> {
    const [
      diagnostics,
      settings,
      llmRuntime,
      groups,
      legacyScheduleFiles,
      whatsAppRuntime,
      llmRuns,
      conversationAudit,
      importedScheduleEvents,
      alertsFilePresent,
      automationsFilePresent,
    ] = await Promise.all([
      this.config.readDiagnostics(),
      this.config.readSettings(),
      this.config.readLlmRuntimeStatus(),
      this.config.listGroups(),
      this.config.listLegacyScheduleFiles(),
      this.config.readWhatsAppRuntime(),
      this.config.readLlmLogs(20),
      this.config.readConversationAudit(20),
      countImportedScheduleEvents(this.config.paths.dataRootPath),
      fileExists(this.config.paths.waNotifyAlertsFilePath),
      fileExists(this.config.paths.waNotifyAutomationsFilePath),
    ]);

    const codexAuthReady = Boolean(
      llmRuntime.providerReadiness.find((provider) => provider.providerId === 'codex-oauth')?.ready,
    );
    const checklist: readonly MigrationReadinessChecklistItemSnapshot[] = [
      buildRuntimeChecklistItem(diagnostics),
      buildLlmChecklistItem(settings, llmRuntime, codexAuthReady),
      buildWhatsAppChecklistItem(whatsAppRuntime),
      buildLegacySourcesChecklistItem(legacyScheduleFiles.length, alertsFilePresent, automationsFilePresent),
      buildParityChecklistItem(
        importedScheduleEvents,
        settings.alerts.rules.length,
        settings.automations.definitions.length,
      ),
      buildAuditChecklistItem(llmRuns.length, conversationAudit.length),
    ];
    const blockers = checklist.filter((item) => item.status === 'blocked').map((item) => item.label);
    const cutoverDecisionReady =
      blockers.length === 0 &&
      importedScheduleEvents > 0 &&
      settings.alerts.rules.length > 0 &&
      settings.automations.definitions.length > 0 &&
      llmRuns.length > 0 &&
      conversationAudit.length > 0;

    return {
      generatedAt: new Date().toISOString(),
      recommendedPhase: blockers.length > 0 ? 'blocked' : 'shadow_mode',
      cutoverDecisionReady,
      summary:
        blockers.length > 0
          ? 'Ainda ha bloqueadores tecnicos antes de entrares em shadow mode.'
          : cutoverDecisionReady
            ? 'Base automatica pronta. Faz a semana em shadow mode e decide o cutover no fim.'
            : 'A base tecnica ja permite entrar em shadow mode, mas ainda convem recolher sinais reais antes de decidir o cutover.',
      runtime: {
        phase: diagnostics.phase,
        ready: diagnostics.readiness.ready,
        lastTickAt: diagnostics.operational.lastTickAt,
        lastError: diagnostics.operational.lastError,
      },
      llm: {
        configuredProvider: settings.llm.provider,
        effectiveProvider: llmRuntime.effectiveProviderId,
        effectiveModel: llmRuntime.effectiveModelId,
        mode: llmRuntime.mode,
        codexAuthReady,
        fallbackReason: llmRuntime.fallbackReason,
      },
      whatsapp: {
        phase: whatsAppRuntime.session.phase,
        connected: whatsAppRuntime.session.connected,
        loginRequired: whatsAppRuntime.session.loginRequired,
        discoveredGroups: whatsAppRuntime.groups.length,
        discoveredConversations: whatsAppRuntime.conversations.length,
      },
      legacySources: {
        schedulesRootPath: this.config.paths.waNotifySchedulesRootPath,
        scheduleFileCount: legacyScheduleFiles.length,
        alertsFilePath: this.config.paths.waNotifyAlertsFilePath,
        alertsFilePresent,
        automationsFilePath: this.config.paths.waNotifyAutomationsFilePath,
        automationsFilePresent,
      },
      lumeHubState: {
        knownGroups: groups.length,
        importedScheduleEvents,
        alertRules: settings.alerts.rules.length,
        automationDefinitions: settings.automations.definitions.length,
        llmRunCount: llmRuns.length,
        conversationAuditCount: conversationAudit.length,
      },
      checklist,
      blockers,
      comparison: [
        {
          label: 'Schedules da semana',
          tone: importedScheduleEvents > 0 ? 'positive' : 'warning',
          waNotify: `${legacyScheduleFiles.length} ficheiro(s) legacy visivel/visiveis para comparar.`,
          lumeHub:
            importedScheduleEvents > 0
              ? `${importedScheduleEvents} evento(s) ja vivem no storage mensal canonico.`
              : 'Ainda nao ha eventos importados no storage mensal.',
        },
        {
          label: 'LLM e respostas',
          tone: llmRuntime.mode === 'live' ? 'positive' : 'warning',
          waNotify: 'Provider real continua a ser a referencia produtiva.',
          lumeHub:
            llmRuntime.mode === 'live'
              ? `Provider real ${llmRuntime.effectiveProviderId} ativo.`
              : llmRuntime.fallbackReason ?? 'Fallback ainda presente.',
        },
        {
          label: 'WhatsApp e descoberta',
          tone:
            whatsAppRuntime.session.phase === 'open' && whatsAppRuntime.groups.length > 0 ? 'positive' : 'warning',
          waNotify: 'Sessao produtiva e descoberta atual continuam como referencia.',
          lumeHub: `${whatsAppRuntime.groups.length} grupo(s) e ${whatsAppRuntime.conversations.length} conversa(s) visiveis no runtime novo.`,
        },
        {
          label: 'Alerts e automations',
          tone:
            settings.alerts.rules.length > 0 && settings.automations.definitions.length > 0 ? 'positive' : 'warning',
          waNotify: 'Os ficheiros legacy continuam disponiveis para comparacao paralela.',
          lumeHub: `${settings.alerts.rules.length} alert(s) e ${settings.automations.definitions.length} automation(s) carregados no runtime novo.`,
        },
      ],
      shadowModeChecks: [
        'Operar uma semana real com WA-notify e LumeHub em paralelo, sem cortar o sistema antigo.',
        'Comparar todos os dias os schedules, os envios principais e as respostas do assistente.',
        'Registar qualquer divergencia antes de pensar em cutover total.',
      ],
      cutoverChecks: [
        'No fim da semana paralela, confirmar que nao houve regressao funcional evidente.',
        'Validar que o operador consegue trabalhar no LumeHub sem recorrer ao WA-notify para tarefas normais.',
        'Guardar logs do launcher e snapshot de /api/runtime/diagnostics antes do corte final.',
      ],
    };
  }
}

function buildRuntimeChecklistItem(
  diagnostics: BackendRuntimeDiagnosticsState,
): MigrationReadinessChecklistItemSnapshot {
  if (!diagnostics.readiness.ready || diagnostics.phase === 'stopped') {
    return {
      itemId: 'runtime',
      label: 'Runtime live estavel',
      status: 'blocked',
      summary: 'O backend ainda nao esta pronto ou foi detetado como parado.',
    };
  }

  if (diagnostics.phase === 'degraded' || diagnostics.operational.lastError) {
    return {
      itemId: 'runtime',
      label: 'Runtime live estavel',
      status: 'review',
      summary: diagnostics.operational.lastError ?? 'O runtime esta de pe, mas ha degradacao para rever.',
    };
  }

  return {
    itemId: 'runtime',
    label: 'Runtime live estavel',
    status: 'ready',
    summary: 'Backend, watchdog e diagnostico estao a responder como esperado.',
  };
}

function buildLlmChecklistItem(
  settings: AdminSettings,
  llmRuntime: LlmRuntimeStatusSnapshot,
  codexAuthReady: boolean,
): MigrationReadinessChecklistItemSnapshot {
  if (!settings.llm.enabled) {
    return {
      itemId: 'llm',
      label: 'LLM real por defeito',
      status: 'blocked',
      summary: 'A LLM live esta desligada nesta configuracao.',
    };
  }

  if (!codexAuthReady) {
    return {
      itemId: 'llm',
      label: 'LLM real por defeito',
      status: 'blocked',
      summary: llmRuntime.fallbackReason ?? 'A auth do Codex ainda nao esta pronta.',
    };
  }

  if (llmRuntime.mode !== 'live') {
    return {
      itemId: 'llm',
      label: 'LLM real por defeito',
      status: 'review',
      summary: llmRuntime.fallbackReason ?? 'Ainda ha fallback para rever.',
    };
  }

  return {
    itemId: 'llm',
    label: 'LLM real por defeito',
    status: 'ready',
    summary: `Provider efetivo ${llmRuntime.effectiveProviderId} com modelo ${llmRuntime.effectiveModelId}.`,
  };
}

function buildWhatsAppChecklistItem(
  runtime: WhatsAppRuntimeSnapshot,
): MigrationReadinessChecklistItemSnapshot {
  if (runtime.session.phase === 'disabled' || runtime.session.phase === 'error') {
    return {
      itemId: 'whatsapp',
      label: 'WhatsApp pronto para semana paralela',
      status: 'blocked',
      summary: runtime.session.lastError ?? 'O canal WhatsApp ainda nao esta operacional.',
    };
  }

  if (runtime.session.phase !== 'open' || runtime.groups.length === 0) {
    return {
      itemId: 'whatsapp',
      label: 'WhatsApp pronto para semana paralela',
      status: 'review',
      summary:
        runtime.session.phase === 'qr_pending'
          ? 'A sessao ainda esta a aguardar emparelhamento por QR.'
          : `Fase atual ${runtime.session.phase}; grupos visiveis ${runtime.groups.length}.`,
    };
  }

  return {
    itemId: 'whatsapp',
    label: 'WhatsApp pronto para semana paralela',
    status: 'ready',
    summary: `${runtime.groups.length} grupo(s) e ${runtime.conversations.length} conversa(s) descobertos no runtime novo.`,
  };
}

function buildLegacySourcesChecklistItem(
  scheduleFileCount: number,
  alertsFilePresent: boolean,
  automationsFilePresent: boolean,
): MigrationReadinessChecklistItemSnapshot {
  if (scheduleFileCount === 0 || !alertsFilePresent || !automationsFilePresent) {
    return {
      itemId: 'legacy_sources',
      label: 'Fontes WA-notify visiveis',
      status: 'blocked',
      summary: `Schedules=${scheduleFileCount}, alerts=${alertsFilePresent ? 'ok' : 'missing'}, automations=${automationsFilePresent ? 'ok' : 'missing'}.`,
    };
  }

  return {
    itemId: 'legacy_sources',
    label: 'Fontes WA-notify visiveis',
    status: 'ready',
    summary: `${scheduleFileCount} ficheiro(s) de schedules legacy e ambos os ficheiros de alerts/automations visiveis.`,
  };
}

function buildParityChecklistItem(
  importedScheduleEvents: number,
  alertRules: number,
  automationDefinitions: number,
): MigrationReadinessChecklistItemSnapshot {
  if (importedScheduleEvents === 0) {
    return {
      itemId: 'parity',
      label: 'Dados minimos importados no runtime novo',
      status: 'blocked',
      summary: 'Ainda nao ha schedules importados para comparar com a semana real.',
    };
  }

  if (alertRules === 0 || automationDefinitions === 0) {
    return {
      itemId: 'parity',
      label: 'Dados minimos importados no runtime novo',
      status: 'review',
      summary: `Schedules=${importedScheduleEvents}, alerts=${alertRules}, automations=${automationDefinitions}.`,
    };
  }

  return {
    itemId: 'parity',
    label: 'Dados minimos importados no runtime novo',
    status: 'ready',
    summary: `${importedScheduleEvents} evento(s), ${alertRules} alert(s) e ${automationDefinitions} automation(s) ja vivem no runtime novo.`,
  };
}

function buildAuditChecklistItem(
  llmRunCount: number,
  conversationAuditCount: number,
): MigrationReadinessChecklistItemSnapshot {
  if (llmRunCount === 0 && conversationAuditCount === 0) {
    return {
      itemId: 'audit',
      label: 'Sinais auditaveis recolhidos',
      status: 'review',
      summary: 'Ainda nao ha runs ou auditoria recente suficientes para comparar comportamento real.',
    };
  }

  if (conversationAuditCount === 0) {
    return {
      itemId: 'audit',
      label: 'Sinais auditaveis recolhidos',
      status: 'review',
      summary: `${llmRunCount} run(s) LLM ja existem, mas ainda faltam respostas auditadas do pipeline conversacional.`,
    };
  }

  return {
    itemId: 'audit',
    label: 'Sinais auditaveis recolhidos',
    status: 'ready',
    summary: `${llmRunCount} run(s) LLM e ${conversationAuditCount} resposta(s) auditada(s) prontas para comparar.`,
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function countImportedScheduleEvents(dataRootPath: string): Promise<number> {
  const groupsRootPath = join(dataRootPath, 'groups');
  let total = 0;

  try {
    const groupEntries = await readdir(groupsRootPath, { withFileTypes: true });

    for (const groupEntry of groupEntries) {
      if (!groupEntry.isDirectory()) {
        continue;
      }

      const calendarDirectoryPath = join(groupsRootPath, groupEntry.name, 'calendar');
      let calendarFiles;

      try {
        calendarFiles = await readdir(calendarDirectoryPath, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const calendarFile of calendarFiles) {
        if (!calendarFile.isFile() || !calendarFile.name.endsWith('.json')) {
          continue;
        }

        try {
          const raw = await readFile(join(calendarDirectoryPath, calendarFile.name), 'utf8');
          const parsed = JSON.parse(raw) as { readonly events?: readonly unknown[] };
          total += Array.isArray(parsed.events) ? parsed.events.length : 0;
        } catch {
          continue;
        }
      }
    }
  } catch {
    return 0;
  }

  return total;
}
