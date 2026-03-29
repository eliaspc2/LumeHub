import { AssistantConsoleUiModule } from '@lume-hub/assistant-console';
import { DashboardUiModule } from '@lume-hub/dashboard';
import { DeliveryMonitorUiModule } from '@lume-hub/delivery-monitor';
import type {
  FrontendApiClient,
  GroupContextPreviewSnapshot,
  GroupIntelligenceSnapshot,
  Instruction,
  MediaAssetSnapshot,
  SettingsSnapshot,
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
  readonly legacyRoutes?: readonly string[];
  render(): Promise<UiPage>;
}

export interface WhatsAppManagementPageData {
  readonly workspace: import('@lume-hub/frontend-api-client').WhatsAppWorkspaceSnapshot;
  readonly people: readonly Person[];
}

export interface GroupManagementPageData {
  readonly groups: readonly import('@lume-hub/frontend-api-client').Group[];
  readonly commandSettings: SettingsSnapshot['adminSettings']['commands'];
  readonly selectedGroupJid: string | null;
  readonly previewText: string;
  readonly intelligence: GroupIntelligenceSnapshot | null;
  readonly contextPreview: GroupContextPreviewSnapshot | null;
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
  private readonly weekPlanner = new WeekPlannerUiModule();
  private readonly assistant = new AssistantConsoleUiModule();
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
    label: 'Configuracao',
  });

  constructor(
    private readonly client: FrontendApiClient,
    private readonly queryClient: QueryClient,
  ) {}

  navigation(): readonly NavigationItem[] {
    return this.routes()
      .filter((route) => route.route !== '/settings')
      .map((route) => ({
        route: route.route,
        label: route.label,
      }));
  }

  normalizeRoute(rawPath: string): string {
    const pathname = new URL(rawPath, 'http://lume-hub.local').pathname;
    return this.legacyRouteAliases().get(pathname) ?? pathname;
  }

  resolveRoute(rawPath: string): AppRouteDefinition {
    const normalized = this.normalizeRoute(rawPath);
    return this.routes().find((route) => route.route === normalized) ?? this.routes()[0];
  }

  routes(): readonly AppRouteDefinition[] {
    return [
      {
        route: this.dashboard.config.route,
        label: this.dashboard.config.label,
        description: 'Resumo claro do estado atual, do WhatsApp e do que merece atencao primeiro.',
        legacyRoutes: ['/', '/dashboard'],
        render: async () => this.dashboard.render(await this.readQuery('dashboard', () => this.client.getDashboard())),
      },
      {
        route: this.weekPlanner.config.route,
        label: this.weekPlanner.config.label,
        description: 'Agenda semanal para criar e rever aulas e avisos.',
        legacyRoutes: ['/week-planner'],
        render: async () => this.weekPlanner.render(await this.readQuery('weekly-planner', () => this.client.getWeeklyPlanner())),
      },
      {
        route: this.assistant.config.route,
        label: this.assistant.config.label,
        description: 'Entrada dedicada ao assistente, com linguagem simples e espaco para contexto.',
        legacyRoutes: ['/assistant-console'],
        render: async () => {
          const [settings, models, recentRuns, recentConversationAudit] = await Promise.all([
            this.readQuery('settings', () => this.client.getSettings()),
            this.readQuery('llm-models', () => this.client.listLlmModels({ refresh: false })),
            this.readQuery('llm-logs', () => this.client.listLlmLogs(8)),
            this.readQuery('conversation-logs', () => this.client.listConversationLogs(8)),
          ]);

          return this.assistant.render({
            provider: settings.adminSettings.llm.provider,
            model: settings.adminSettings.llm.model,
            assistantEnabled: settings.adminSettings.commands.assistantEnabled,
            directRepliesEnabled: settings.adminSettings.commands.directRepliesEnabled,
            availableModels: models.map((model) => ({
              providerId: model.providerId,
              modelId: model.modelId,
              label: model.label,
            })),
            recentRuns: recentRuns.map((entry) => ({
              runId: entry.runId,
              operation: entry.operation,
              providerId: entry.providerId,
              modelId: entry.modelId,
              createdAt: entry.createdAt,
              outputSummary: entry.outputSummary,
              memorySummary: describeRunMemory(entry),
            })),
            recentConversationAudit: recentConversationAudit.map((entry) => ({
              auditId: entry.auditId,
              chatJid: entry.chatJid,
              intent: entry.intent,
              replyMode: entry.replyMode,
              createdAt: entry.createdAt,
              replyText: entry.replyText,
              memorySummary: describeConversationMemory(entry),
            })),
          });
        },
      },
      {
        route: '/workspace',
        label: 'Projeto',
        description: 'Pedir a uma LLM para ler, rever e alterar ficheiros do LumeHub sem sair da interface.',
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
        route: this.routing.config.route,
        label: this.routing.config.label,
        description: 'Visao de distribuicoes, regras declarativas e estados de fan-out.',
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
        render: async () =>
          this.watchdog.render(await this.readQuery('watchdog-issues', () => this.client.getWatchdogIssues())),
      },
      {
        route: this.groupDirectory.config.route,
        label: this.groupDirectory.config.label,
        description: 'Catalogo de grupos, owners e politicas de acesso em linguagem mais humana.',
        render: async () => {
          const [groups, settings] = await Promise.all([
            this.readQuery('groups', () => this.client.listGroups()),
            this.readQuery('settings', () => this.client.getSettings()),
          ]);
          const selectedGroupJid =
            this.groupManagementSelection.selectedGroupJid && groups.some((group) => group.groupJid === this.groupManagementSelection.selectedGroupJid)
              ? this.groupManagementSelection.selectedGroupJid
              : groups[0]?.groupJid ?? null;
          const basePage = this.groupDirectory.render(groups);
          let intelligence: GroupIntelligenceSnapshot | null = null;
          let contextPreview: GroupContextPreviewSnapshot | null = null;
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
          }

          return {
            ...basePage,
            data: {
              groups,
              commandSettings: settings.adminSettings.commands,
              selectedGroupJid,
              previewText: this.groupManagementSelection.previewText,
              intelligence,
              contextPreview,
              loadWarning,
            } satisfies GroupManagementPageData,
          };
        },
      },
      {
        route: this.whatsapp.config.route,
        label: this.whatsapp.config.label,
        description: 'Ligacao do canal, grupos conhecidos, conversas privadas e permissoes efetivas.',
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
        route: '/media',
        label: 'Media',
        description: 'Biblioteca operacional da media recebida por WhatsApp, pronta para identificar origem e preparar distribuicao.',
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
      {
        route: this.settings.config.route,
        label: this.settings.config.label,
        description: 'Area secundaria para defaults, energia, host companion e auth.',
        render: async () => this.settings.render(await this.readQuery('settings', () => this.client.getSettings())),
      },
    ];
  }

  async renderRoute(rawPath: string): Promise<UiPage> {
    return this.resolveRoute(rawPath).render();
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
      ['/assistant-console', '/assistant'],
      ['/routing-fanout', '/distributions'],
      ['/delivery-monitor', '/deliveries'],
    ]);
  }
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

function isMediaInstruction(instruction: Instruction): boolean {
  return instruction.actions.some((action) => {
    const payload = action.payload as { readonly kind?: unknown } | undefined;
    return payload?.kind === 'media';
  });
}
