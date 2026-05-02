import { DashboardUiModule } from '@lume-hub/dashboard';
import { DeliveryMonitorUiModule } from '@lume-hub/delivery-monitor';
import type {
  AssistantScheduleApplySnapshot,
  AssistantSchedulePreviewSnapshot,
  FrontendApiClient,
  GroupContextPreviewSnapshot,
  GroupIntelligenceSnapshot,
  Instruction,
  LegacyAlertImportReportSnapshot,
  LegacyAutomationImportReportSnapshot,
  LegacyScheduleImportFileSnapshot,
  LegacyScheduleImportReportSnapshot,
  MessageAlertMatchSnapshot,
  MediaAssetSnapshot,
  MigrationReadinessSnapshot,
  SettingsSnapshot,
  AutomationRunSnapshot,
  WeeklyPlannerSnapshot,
  WorkspaceAgentStatusSnapshot,
  WorkspaceAgentRunSnapshot,
  WorkspaceFileSnapshot,
} from '@lume-hub/frontend-api-client';
import { GroupDirectoryConsoleUiModule } from '@lume-hub/group-directory-console';
import type { Person } from '@lume-hub/people-memory';
import { QueueConsoleUiModule } from '@lume-hub/queue-console';
import { SettingsCenterUiModule } from '@lume-hub/settings-center';
import type { NavigationItem, UiPage } from '@lume-hub/shared-ui';
import { WeekPlannerUiModule } from '@lume-hub/week-planner';
import { WhatsAppConsoleUiModule } from '@lume-hub/whatsapp-console';
import { WatchdogInboxUiModule } from '@lume-hub/watchdog-inbox';

import type { QueryClient } from './QueryClientFactory.js';

export interface AppRouteDefinition {
  readonly route: string;
  readonly label: string;
  readonly description: string;
  readonly navigationPlacement?: 'primary' | 'secondary' | 'hidden';
  readonly legacyRoutes?: readonly string[];
  render(): Promise<UiPage>;
}

export interface ResolvedAppRoute extends AppRouteDefinition {
  readonly canonicalRoute: string;
  readonly params: Readonly<Record<string, string>>;
}

export interface AppNavigationSections {
  readonly primary: readonly NavigationItem[];
  readonly secondary: readonly NavigationItem[];
}

export interface WhatsAppManagementPageData {
  readonly workspace: import('@lume-hub/frontend-api-client').WhatsAppWorkspaceSnapshot;
  readonly people: readonly Person[];
}

export interface GroupManagementPageData {
  readonly groups: readonly import('@lume-hub/frontend-api-client').Group[];
  readonly people: readonly Person[];
  readonly commandSettings: SettingsSnapshot['adminSettings']['commands'];
  readonly selectedGroupJid: string | null;
  readonly previewText: string;
  readonly intelligence: GroupIntelligenceSnapshot | null;
  readonly contextPreview: GroupContextPreviewSnapshot | null;
  readonly reminderPreviewEvent: WeeklyPlannerSnapshot['events'][number] | null;
  readonly loadWarning: string | null;
}

export interface MediaLibraryPageData {
  readonly assets: readonly MediaAssetSnapshot[];
  readonly groups: readonly import('@lume-hub/frontend-api-client').Group[];
  readonly instructions: readonly Instruction[];
}

export interface WorkspaceAgentPageData {
  readonly files: readonly WorkspaceFileSnapshot[];
  readonly recentRuns: readonly WorkspaceAgentRunSnapshot[];
  readonly status: WorkspaceAgentStatusSnapshot;
}

export interface AssistantSchedulingAuditEntry {
  readonly instructionId: string;
  readonly status: Instruction['status'];
  readonly operation: 'create' | 'update' | 'delete' | null;
  readonly groupJid: string | null;
  readonly groupLabel: string | null;
  readonly requestedText: string;
  readonly previewSummary: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resultNote: string | null;
  readonly appliedEventTitle: string | null;
}

export interface AssistantPageData {
  readonly settings: SettingsSnapshot;
  readonly groups: readonly import('@lume-hub/frontend-api-client').Group[];
  readonly recentLlmRuns: readonly import('@lume-hub/frontend-api-client').LlmRunLogEntry[];
  readonly recentConversationAudit: readonly import('@lume-hub/frontend-api-client').ConversationAuditRecord[];
  readonly recentSchedulingAudit: readonly AssistantSchedulingAuditEntry[];
  readonly schedulingPreview: AssistantSchedulePreviewSnapshot | null;
  readonly lastAppliedSchedule: AssistantScheduleApplySnapshot | null;
}

export interface SettingsPageData {
  readonly settings: SettingsSnapshot;
  readonly people: readonly Person[];
  readonly whatsappWorkspace: import('@lume-hub/frontend-api-client').WhatsAppWorkspaceSnapshot;
}

export interface CodexRouterPageData {
  readonly settings: SettingsSnapshot;
}

export interface MigrationPageData {
  readonly settings: SettingsSnapshot;
  readonly migrationReadiness: MigrationReadinessSnapshot;
  readonly legacyScheduleImportFiles: readonly LegacyScheduleImportFileSnapshot[];
  readonly legacyScheduleImportReport: LegacyScheduleImportReportSnapshot | null;
  readonly legacyAlertImportReport: LegacyAlertImportReportSnapshot | null;
  readonly legacyAutomationImportReport: LegacyAutomationImportReportSnapshot | null;
  readonly recentAlertMatches: readonly MessageAlertMatchSnapshot[];
  readonly recentAutomationRuns: readonly AutomationRunSnapshot[];
}

export class AppRouter {
  private groupManagementSelection: {
    selectedGroupJid: string | null;
    previewText: string;
  } = {
    selectedGroupJid: null,
    previewText: 'A Aula 1 mudou?',
  };
  private readonly dashboard = new DashboardUiModule({
    route: '/today',
    label: 'Hoje',
  });
  private readonly weekPlanner = new WeekPlannerUiModule({
    route: '/week',
    label: 'Calendario',
  });
  private readonly routing = new QueueConsoleUiModule({
    route: '/distributions',
    label: 'Distribuicoes',
  });
  private readonly delivery = new DeliveryMonitorUiModule();
  private readonly watchdog = new WatchdogInboxUiModule();
  private readonly groupDirectory = new GroupDirectoryConsoleUiModule();
  private readonly whatsapp = new WhatsAppConsoleUiModule();
  private readonly settings = new SettingsCenterUiModule({
    route: '/settings',
    label: 'Configuracoes',
  });

  constructor(
    private readonly client: FrontendApiClient,
    private readonly queryClient: QueryClient,
  ) {}

  navigation(): AppNavigationSections {
    const cachedSettings = this.queryClient.get<SettingsSnapshot>('settings');
    const items = this.routes().map((route) => ({
      route: route.route,
      label: route.label,
      placement:
        route.route === '/codex-router' && cachedSettings?.adminSettings.ui.codexRouterVisible === false
          ? 'hidden'
          : route.navigationPlacement ?? 'hidden',
    }));

    return {
      primary: items
        .filter((item) => item.placement === 'primary')
        .map(({ route, label }) => ({ route, label })),
      secondary: items
        .filter((item) => item.placement === 'secondary')
        .map(({ route, label }) => ({ route, label })),
    };
  }

  normalizeRoute(rawPath: string): string {
    const pathname = normalizeAppPathname(new URL(rawPath, 'http://lume-hub.local').pathname);
    const dynamicGroupJid = readDynamicGroupRouteJid(pathname);

    if (dynamicGroupJid) {
      return `/groups/${encodeURIComponent(dynamicGroupJid)}`;
    }

    return this.legacyRouteAliases().get(pathname) ?? pathname;
  }

  resolveRoute(rawPath: string): ResolvedAppRoute {
    const normalized = this.normalizeRoute(rawPath);
    const dynamicGroupJid = readDynamicGroupRouteJid(normalized);

    if (dynamicGroupJid) {
      const route = this.routes().find((candidate) => candidate.route === '/groups') ?? this.routes()[0];
      return {
        ...route,
        route: normalized,
        canonicalRoute: route.route,
        params: {
          groupJid: dynamicGroupJid,
        },
      };
    }

    const route = this.routes().find((candidate) => candidate.route === normalized) ?? this.routes()[0];
    return {
      ...route,
      canonicalRoute: route.route,
      params: {},
    };
  }

  routes(): readonly AppRouteDefinition[] {
    return [
      {
        route: this.dashboard.config.route,
        label: this.dashboard.config.label,
        description: 'Entrada principal com o que esta bem, o que pede atencao e o proximo passo recomendado.',
        navigationPlacement: 'primary',
        legacyRoutes: ['/', '/dashboard'],
        render: async () => this.dashboard.render(await this.readQuery('dashboard', () => this.client.getDashboard())),
      },
      {
        route: this.weekPlanner.config.route,
        label: 'Calendario',
        description: 'Agenda semanal para rever o que esta marcado e abrir o detalhe de cada grupo.',
        navigationPlacement: 'primary',
        legacyRoutes: ['/week-planner'],
        render: async () => this.weekPlanner.render(await this.readQuery('weekly-planner', () => this.client.getWeeklyPlanner())),
      },
      {
        route: this.groupDirectory.config.route,
        label: this.groupDirectory.config.label,
        description: 'Catalogo curto de grupos e entrada para o workspace detalhado de cada grupo.',
        navigationPlacement: 'primary',
        render: async () => {
          const [groups, settings, people] = await Promise.all([
            this.readQuery('groups', () => this.client.listGroups()),
            this.readQuery('settings', () => this.client.getSettings()),
            this.readOptionalPeople(),
          ]);
          const selectedGroupJid =
            this.groupManagementSelection.selectedGroupJid && groups.some((group) => group.groupJid === this.groupManagementSelection.selectedGroupJid)
              ? this.groupManagementSelection.selectedGroupJid
              : groups[0]?.groupJid ?? null;
          const basePage = this.groupDirectory.render(groups);
          let intelligence: GroupIntelligenceSnapshot | null = null;
          let contextPreview: GroupContextPreviewSnapshot | null = null;
          let reminderPreviewEvent: WeeklyPlannerSnapshot['events'][number] | null = null;
          let loadWarning: string | null = null;

          if (selectedGroupJid) {
            try {
              intelligence = await this.client.getGroupIntelligence(selectedGroupJid);
            } catch (error) {
              loadWarning = `As instrucoes e a knowledge base deste grupo ainda nao puderam ser carregadas live. ${readErrorMessage(error)}`;
            }

            if (this.groupManagementSelection.previewText.trim().length > 0) {
              try {
                contextPreview = await this.client.previewGroupContext(selectedGroupJid, {
                  text: this.groupManagementSelection.previewText,
                });
              } catch (error) {
                loadWarning ??=
                  `O preview contextual deste grupo ainda nao ficou disponivel live. ${readErrorMessage(error)}`;
              }
            }

            try {
              const groupWeek = await this.client.getWeeklyPlanner({
                groupJid: selectedGroupJid,
              });
              reminderPreviewEvent = groupWeek.events[0] ?? null;
            } catch (error) {
              loadWarning ??=
                `Ainda nao foi possivel ler um evento de exemplo deste grupo para os lembretes. ${readErrorMessage(error)}`;
            }
          }

          return {
            ...basePage,
            data: {
              groups,
              people,
              commandSettings: settings.adminSettings.commands,
              selectedGroupJid,
              previewText: this.groupManagementSelection.previewText,
              intelligence,
              contextPreview,
              reminderPreviewEvent,
              loadWarning,
            } satisfies GroupManagementPageData,
          };
        },
      },
      {
        route: this.whatsapp.config.route,
        label: this.whatsapp.config.label,
        description: 'Ligacao do WhatsApp, grupos conhecidos e o que o canal pode fazer neste momento.',
        navigationPlacement: 'primary',
        render: async () => {
          const workspace = await this.readQuery('whatsapp-workspace', () => this.client.getWhatsAppWorkspace());
          const people = await this.readOptionalPeople();
          const basePage = this.whatsapp.render(workspace);

          return {
            ...basePage,
            data: {
              workspace,
              people,
            } satisfies WhatsAppManagementPageData,
          };
        },
      },
      {
        route: this.settings.config.route,
        label: this.settings.config.label,
        description: 'Regras gerais da app, assistente, energia e arranque do LumeHub.',
        navigationPlacement: 'primary',
        render: async () => ({
          route: '/settings',
          title: 'Configuracoes',
          description: 'Regras gerais da app, assistente, energia e arranque do LumeHub.',
          sections: [],
          data: await this.readSettingsPageData(),
        }),
      },
      {
        route: '/assistant',
        label: 'LLM',
        description: 'Faz uma pergunta ao assistente, em global ou num grupo, sem sair da interface.',
        navigationPlacement: 'primary',
        render: async () => {
          const [settings, recentRuns, recentConversationAudit, groups, queue] = await Promise.all([
            this.readQuery('settings', () => this.client.getSettings()),
            this.readQuery('llm-logs', () => this.client.listLlmLogs(8)),
            this.readQuery('conversation-logs', () => this.client.listConversationLogs(8)),
            this.readQuery('groups', () => this.client.listGroups()),
            this.readQuery('instruction-queue', () => this.client.listInstructionQueue()),
          ]);

          return {
            route: '/assistant',
            title: 'LLM',
            description: 'Faz uma pergunta ao assistente, em global ou num grupo, sem sair da interface.',
            sections: [
              {
                title: 'LLM live',
                lines: [
                  `Configurado: ${settings.adminSettings.llm.provider} / ${settings.adminSettings.llm.model}`,
                  `Em uso agora: ${settings.llmRuntime.effectiveProviderId} / ${settings.llmRuntime.effectiveModelId}`,
                  `Estado live: ${settings.llmRuntime.mode}`,
                  settings.llmRuntime.fallbackReason ? `Motivo do fallback: ${settings.llmRuntime.fallbackReason}` : 'Provider real ativo.',
                ],
              },
            ],
            data: {
              settings,
              groups,
              recentLlmRuns: recentRuns,
              recentConversationAudit,
              recentSchedulingAudit: queue
                .filter((instruction) => instruction.sourceType === 'assistant_schedule_apply')
                .slice()
                .reverse()
                .slice(0, 8)
                .map((instruction) => mapAssistantSchedulingAuditEntry(instruction)),
              schedulingPreview: null,
              lastAppliedSchedule: null,
            } satisfies AssistantPageData,
          };
        },
      },
      {
        route: '/codex-router',
        label: 'Codex Router',
        description: 'Escolhe o token em uso e decide se a troca pode ser automatica.',
        navigationPlacement: 'secondary',
        legacyRoutes: ['/codex-auth-router', '/oauth-router'],
        render: async () => ({
          route: '/codex-router',
          title: 'Codex Router',
          description: 'Escolhe o token em uso e decide se a troca pode ser automatica.',
          sections: [],
          data: {
            settings: await this.readQuery('settings', () => this.client.getSettings()),
          } satisfies CodexRouterPageData,
        }),
      },
      {
        route: this.routing.config.route,
        label: this.routing.config.label,
        description: 'Visao de distribuicoes, regras declarativas e estados de fan-out.',
        navigationPlacement: 'hidden',
        legacyRoutes: ['/routing-fanout'],
        render: async () =>
          this.routing.render({
            rules: await this.readQuery('routing-rules', () => this.client.listRoutingRules()),
            distributions: await this.readQuery('routing-distributions', () => this.client.listDistributions()),
            groups: (await this.readQuery('groups', () => this.client.listGroups())).map((group) => ({
              groupJid: group.groupJid,
              preferredSubject: group.preferredSubject,
            })),
          }),
      },
      {
        route: this.delivery.config.route,
        label: this.delivery.config.label,
        description: 'Estado das entregas e confirmacoes mais recentes.',
        navigationPlacement: 'hidden',
        legacyRoutes: ['/delivery-monitor'],
        render: async () => {
          const dashboard = await this.readQuery('dashboard', () => this.client.getDashboard());

          return this.delivery.render({
            pending: dashboard.health.jobs.pending,
            waitingConfirmation: dashboard.health.jobs.waitingConfirmation,
            sent: dashboard.health.jobs.sent,
            openIssues: dashboard.watchdog.openIssues,
          });
        },
      },
      {
        route: this.watchdog.config.route,
        label: this.watchdog.config.label,
        description: 'Inbox de problemas ativos e sinais que merecem acao manual.',
        navigationPlacement: 'hidden',
        render: async () =>
          this.watchdog.render(await this.readQuery('watchdog-issues', () => this.client.getWatchdogIssues())),
      },
      {
        route: '/workspace',
        label: 'Projeto',
        description: 'Pedir a uma LLM para ler, rever e alterar ficheiros do LumeHub sem sair da interface.',
        navigationPlacement: 'hidden',
        render: async () => {
          const [files, recentRuns, status] = await Promise.all([
            this.readQuery('workspace-files', () => this.client.searchWorkspaceFiles('', 40)),
            this.readQuery('workspace-runs', () => this.client.listWorkspaceAgentRuns(10)),
            this.readQuery('workspace-status', () => this.client.getWorkspaceAgentStatus()),
          ]);

          return {
            route: '/workspace',
            title: 'Projeto',
            description: 'Pedir a uma LLM para ler, rever e alterar ficheiros do LumeHub sem sair da interface.',
            sections: [
              {
                title: 'Resumo',
                lines: [
                  `${files.length} ficheiro(s) listados nesta vista inicial.`,
                  recentRuns.length > 0
                    ? `${recentRuns.length} run(s) recente(s) do agente de projeto.`
                    : 'Ainda nao ha runs do agente de projeto.',
                ],
              },
            ],
            data: {
              files,
              recentRuns,
              status,
            } satisfies WorkspaceAgentPageData,
          };
        },
      },
      {
        route: '/media',
        label: 'Media',
        description: 'Biblioteca operacional da media recebida por WhatsApp, pronta para identificar origem e preparar distribuicao.',
        navigationPlacement: 'hidden',
        render: async () => {
          const [assets, groups, instructionQueue] = await Promise.all([
            this.readQuery('media-assets', () => this.client.listMediaAssets()),
            this.readQuery('groups', () => this.client.listGroups()),
            this.readQuery('instruction-queue', () => this.client.listInstructionQueue()),
          ]);

          return {
            route: '/media',
            title: 'Media',
            description: 'Biblioteca operacional da media recebida por WhatsApp, pronta para identificar origem e preparar distribuicao.',
            sections: [
              {
                title: 'Resumo',
                lines: [
                  assets.length > 0
                    ? `${assets.length} asset${assets.length === 1 ? '' : 's'} disponivel/disponiveis na biblioteca.`
                    : 'Ainda nao entrou media nesta biblioteca operacional.',
                ],
              },
            ],
            data: {
              assets,
              groups,
              instructions: instructionQueue.filter(isMediaInstruction),
            } satisfies MediaLibraryPageData,
          };
        },
      },
    ];
  }

  private async readSettingsPageData(): Promise<SettingsPageData> {
    const [settings, people, whatsappWorkspace] = await Promise.all([
      this.readQuery('settings', () => this.client.getSettings()),
      this.readOptionalPeople(),
      this.readQuery('whatsapp-workspace', () => this.client.getWhatsAppWorkspace()),
    ]);

    return {
      settings,
      people,
      whatsappWorkspace,
    } satisfies SettingsPageData;
  }

  private async readMigrationPageData(): Promise<MigrationPageData> {
    const [settings, migrationReadiness, legacyScheduleImportFiles, recentAlertMatches, recentAutomationRuns] = await Promise.all([
      this.readQuery('settings', () => this.client.getSettings()),
      this.readQuery('migration-readiness', () => this.client.getMigrationReadiness()),
      this.readQuery('legacy-schedule-import-files', () => this.client.listLegacyScheduleImportFiles()),
      this.readQuery('alert-matches', () => this.client.listRecentAlertMatches(8)),
      this.readQuery('automation-runs', () => this.client.listRecentAutomationRuns(8)),
    ]);

    return {
      settings,
      migrationReadiness,
      legacyScheduleImportFiles,
      legacyScheduleImportReport: null,
      legacyAlertImportReport: null,
      legacyAutomationImportReport: null,
      recentAlertMatches,
      recentAutomationRuns,
    } satisfies MigrationPageData;
  }

  async renderRoute(rawPath: string): Promise<UiPage> {
    const resolved = this.resolveRoute(rawPath);

    if (resolved.canonicalRoute === '/groups') {
      this.setGroupManagementSelection(resolved.params.groupJid ?? this.groupManagementSelection.selectedGroupJid);
    }

    return resolved.render();
  }

  setGroupManagementSelection(groupJid: string | null): void {
    this.groupManagementSelection = {
      ...this.groupManagementSelection,
      selectedGroupJid: groupJid,
    };
  }

  setGroupManagementPreviewText(text: string): void {
    this.groupManagementSelection = {
      ...this.groupManagementSelection,
      previewText: text,
    };
  }

  buildGroupRoute(groupJid: string): string {
    return `/groups/${encodeURIComponent(groupJid)}`;
  }

  private async readQuery<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.queryClient.get<T>(key);

    if (cached !== undefined) {
      return cached;
    }

    return this.queryClient.set(key, await loader());
  }

  private async readOptionalPeople(): Promise<readonly Person[]> {
    try {
      return await this.readQuery('people', () => this.client.listPeople());
    } catch {
      return [];
    }
  }

  private legacyRouteAliases(): ReadonlyMap<string, string> {
    return new Map<string, string>([
      ['/', '/today'],
      ['/dashboard', '/today'],
      ['/week-planner', '/week'],
      ['/routing-fanout', '/distributions'],
      ['/delivery-monitor', '/deliveries'],
    ]);
  }
}

function normalizeAppPathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function readDynamicGroupRouteJid(pathname: string): string | null {
  const match = /^\/groups\/([^/]+)$/u.exec(pathname);

  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function describeLlmAuthReadiness(settings: SettingsSnapshot): string {
  const codexAuth = settings.llmRuntime.providerReadiness.find((provider) => provider.providerId === 'codex-oauth');

  if (settings.adminSettings.llm.provider === 'codex-oauth') {
    if (codexAuth?.ready) {
      const accountCount = settings.authRouterStatus?.accountCount ?? 0;
      return accountCount > 0 ? `pronta (${accountCount} conta(s) visiveis)` : 'pronta';
    }

    return codexAuth?.reason ?? 'Auth live ainda nao esta pronta.';
  }

  return settings.llmRuntime.providerReadiness
    .map((provider) => `${provider.label}: ${provider.ready ? 'pronto' : provider.reason ?? 'indisponivel'}`)
    .join(' | ');
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describeRunMemory(
  entry: import('@lume-hub/frontend-api-client').LlmRunLogEntry,
): string {
  if (!entry.memoryScope || entry.memoryScope.scope !== 'group') {
    return 'sem memoria de grupo';
  }

  const documentLabel =
    entry.memoryScope.knowledgeDocuments.length > 0
      ? `docs ${entry.memoryScope.knowledgeDocuments
          .slice(0, 2)
          .map((document) => document.title)
          .join(', ')}`
      : 'sem docs';

  return [
    `grupo ${entry.memoryScope.groupLabel ?? entry.memoryScope.groupJid ?? 'desconhecido'}`,
    `instr ${entry.memoryScope.instructionsSource ?? 'missing'}`,
    `${entry.memoryScope.knowledgeSnippetCount} snippet(s)`,
    documentLabel,
  ].join(' | ');
}

function describeConversationMemory(
  entry: import('@lume-hub/frontend-api-client').ConversationAuditRecord,
): string {
  const memoryUsage = entry.memoryUsage ?? null;

  if (!memoryUsage || memoryUsage.scope !== 'group') {
    return 'sem memoria de grupo';
  }

  const schedulingLabel =
    entry.schedulingInsight && entry.schedulingInsight.resolvedGroupJids.length > 0
      ? `schedule ${entry.schedulingInsight.resolvedGroupJids.join(', ')}`
      : null;
  const documentLabel =
    memoryUsage.knowledgeDocuments.length > 0
      ? `docs ${memoryUsage.knowledgeDocuments
          .slice(0, 2)
          .map((document) => document.title)
          .join(', ')}`
      : 'sem docs';

  return [
    `grupo ${memoryUsage.groupLabel ?? memoryUsage.groupJid ?? 'desconhecido'}`,
    `instr ${memoryUsage.instructionsSource ?? 'missing'}`,
    `${memoryUsage.knowledgeSnippetCount} snippet(s)`,
    documentLabel,
    schedulingLabel,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' | ');
}

function mapAssistantSchedulingAuditEntry(instruction: Instruction): AssistantSchedulingAuditEntry {
  const metadata = instruction.metadata as {
    readonly operation?: unknown;
    readonly groupJid?: unknown;
    readonly groupLabel?: unknown;
    readonly requestedText?: unknown;
    readonly previewSummary?: unknown;
  };
  const completedAction = instruction.actions.find((action) => action.status === 'completed');
  const actionMetadata = (completedAction?.result?.metadata ?? null) as
    | {
        readonly appliedEvent?: {
          readonly title?: unknown;
        } | null;
      }
    | null;

  return {
    instructionId: instruction.instructionId,
    status: instruction.status,
    operation: isAssistantScheduleOperation(metadata.operation) ? metadata.operation : null,
    groupJid: typeof metadata.groupJid === 'string' ? metadata.groupJid : null,
    groupLabel: typeof metadata.groupLabel === 'string' ? metadata.groupLabel : null,
    requestedText: typeof metadata.requestedText === 'string' ? metadata.requestedText : 'Sem texto guardado.',
    previewSummary:
      typeof metadata.previewSummary === 'string' ? metadata.previewSummary : 'Sem resumo do preview guardado.',
    createdAt: instruction.createdAt,
    updatedAt: instruction.updatedAt,
    resultNote: completedAction?.result?.note ?? instruction.actions.find((action) => action.lastError)?.lastError ?? null,
    appliedEventTitle:
      typeof actionMetadata?.appliedEvent?.title === 'string' ? actionMetadata.appliedEvent.title : null,
  };
}

function isAssistantScheduleOperation(value: unknown): value is AssistantSchedulingAuditEntry['operation'] {
  return value === 'create' || value === 'update' || value === 'delete';
}

function isMediaInstruction(instruction: Instruction): boolean {
  return instruction.actions.some((action) => {
    const payload = action.payload as { readonly kind?: unknown } | undefined;
    return payload?.kind === 'media';
  });
}
