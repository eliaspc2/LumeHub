import type {
  AutomationRunSnapshot,
  AssistantScheduleApplySnapshot,
  AssistantSchedulePreviewSnapshot,
  CalendarAccessMode,
  DashboardSnapshot,
  DistributionSummary,
  FrontendUiEvent,
  Group,
  GroupContextPreviewSnapshot,
  GroupIntelligenceSnapshot,
  Instruction,
  LegacyAlertImportReportSnapshot,
  LegacyAutomationImportReportSnapshot,
  LegacyScheduleImportFileSnapshot,
  LegacyScheduleImportReportSnapshot,
  LlmChatInput,
    MediaAssetSnapshot,
    MessageAlertMatchSnapshot,
    Person,
    PersonRole,
    SettingsSnapshot,
  WhatsAppWorkspaceSnapshot,
  WatchdogIssue,
  WorkspaceAgentRunSnapshot,
  WorkspaceFileContentSnapshot,
  WorkspaceFileSnapshot,
} from '@lume-hub/frontend-api-client';
import type { RoutingConsoleSnapshot } from '@lume-hub/queue-console';
import {
  escapeHtml,
  renderUiActionButton,
  renderUiBadge,
  renderUiInputField,
  renderUiMetricCard,
  renderUiPanelCard,
  renderUiRecordCard,
  renderUiSelectField,
  renderUiSwitch,
  renderUiTextAreaField,
  renderUiToggleButton,
  type UiPage,
  type UiTone,
} from '@lume-hub/shared-ui';
import type { WeekPlannerSnapshot } from '@lume-hub/week-planner';

import type { FrontendTransportMode } from '../app/BrowserTransportFactory.js';
import type {
  AssistantPageData,
  AppRouter,
  ResolvedAppRoute,
  GroupManagementPageData,
  MediaLibraryPageData,
  MigrationPageData,
  SettingsPageData,
  WhatsAppManagementPageData,
  WorkspaceAgentPageData,
} from '../app/AppRouter.js';
import type { WebAppBootstrap } from '../app/WebAppBootstrap.js';

type PreviewState = 'none' | 'loading' | 'empty' | 'offline' | 'error';
type ScreenState = 'loading' | 'ready' | 'empty' | 'offline' | 'error';
type ActionDataset = Readonly<Record<string, string | undefined>>;

const ADVANCED_DETAILS_STORAGE_KEY = 'lumehub.web.advanced_details';
const UX_TELEMETRY_STORAGE_KEY = 'lumehub.web.ux_telemetry';
const WEEK_DAY_OPTIONS = [
  { value: 'segunda-feira', label: 'Segunda-feira', shortLabel: 'Seg' },
  { value: 'terca-feira', label: 'Terca-feira', shortLabel: 'Ter' },
  { value: 'quarta-feira', label: 'Quarta-feira', shortLabel: 'Qua' },
  { value: 'quinta-feira', label: 'Quinta-feira', shortLabel: 'Qui' },
  { value: 'sexta-feira', label: 'Sexta-feira', shortLabel: 'Sex' },
  { value: 'sabado', label: 'Sabado', shortLabel: 'Sab' },
  { value: 'domingo', label: 'Domingo', shortLabel: 'Dom' },
] as const;

type WeekDayValue = (typeof WEEK_DAY_OPTIONS)[number]['value'];

interface GuidedScheduleDraft {
  readonly eventId: string | null;
  readonly groupJid: string;
  readonly title: string;
  readonly dayLabel: string;
  readonly startTime: string;
  readonly durationMinutes: string;
  readonly notes: string;
}

interface GuidedDistributionDraft {
  readonly ruleId: string;
  readonly messageSummary: string;
  readonly urgency: string;
  readonly confirmationMode: string;
}

interface GuidedMediaDistributionDraft {
  readonly assetId: string | null;
  readonly caption: string;
  readonly targetGroupJids: readonly string[];
}

interface GroupKnowledgeDraft {
  readonly documentId: string;
  readonly filePath: string;
  readonly title: string;
  readonly summary: string;
  readonly aliases: string;
  readonly tags: string;
  readonly enabled: string;
  readonly content: string;
}

interface GroupManagementDraft {
  readonly selectedGroupJid: string | null;
  readonly instructions: string;
  readonly previewText: string;
  readonly selectedDocumentId: string | null;
  readonly knowledgeDocument: GroupKnowledgeDraft;
}

interface WorkspaceAgentDraft {
  readonly mode: 'plan' | 'apply';
  readonly prompt: string;
  readonly query: string;
  readonly searchResults: readonly WorkspaceFileSnapshot[];
  readonly selectedFilePaths: readonly string[];
  readonly previewPath: string | null;
  readonly previewContent: WorkspaceFileContentSnapshot | null;
  readonly searching: boolean;
  readonly loadingPreview: boolean;
  readonly running: boolean;
}

interface AssistantSchedulingDraft {
  readonly groupJid: string;
  readonly text: string;
  readonly previewLoading: boolean;
  readonly applying: boolean;
  readonly preview: AssistantSchedulePreviewSnapshot | null;
  readonly lastApplied: AssistantScheduleApplySnapshot | null;
}

interface LegacyScheduleMigrationDraft {
  readonly fileName: string;
  readonly previewLoading: boolean;
  readonly applying: boolean;
  readonly report: LegacyScheduleImportReportSnapshot | null;
}

interface LegacyAlertMigrationDraft {
  readonly previewLoading: boolean;
  readonly applying: boolean;
  readonly report: LegacyAlertImportReportSnapshot | null;
}

interface LegacyAutomationMigrationDraft {
  readonly previewLoading: boolean;
  readonly applying: boolean;
  readonly report: LegacyAutomationImportReportSnapshot | null;
}

interface AssistantRailMessage {
  readonly messageId: string;
  readonly role: 'user' | 'assistant' | 'system' | 'error';
  readonly text: string;
  readonly contextLabel: string;
  readonly recordedAt: string;
}

interface AssistantRailChatState {
  readonly contextMode: 'global' | 'group';
  readonly selectedGroupJid: string | null;
  readonly input: string;
  readonly availableGroups: readonly Group[];
  readonly loadingGroups: boolean;
  readonly sending: boolean;
  readonly messages: readonly AssistantRailMessage[];
}

interface AppShellState {
  readonly mode: FrontendTransportMode;
  readonly previewState: PreviewState;
  readonly advancedDetailsEnabled: boolean;
  readonly route: string;
  readonly screenState: ScreenState;
  readonly page: UiPage | null;
  readonly errorMessage: string | null;
  readonly liveEvents: readonly FrontendUiEvent[];
  readonly uxTelemetry: readonly UxTelemetryEntry[];
  readonly lastLoadedAt: string | null;
  readonly scheduleDraft: GuidedScheduleDraft;
  readonly distributionDraft: GuidedDistributionDraft;
  readonly mediaDistributionDraft: GuidedMediaDistributionDraft;
  readonly groupManagementDraft: GroupManagementDraft;
  readonly workspaceAgentDraft: WorkspaceAgentDraft;
  readonly assistantSchedulingDraft: AssistantSchedulingDraft;
  readonly legacyScheduleMigrationDraft: LegacyScheduleMigrationDraft;
  readonly legacyAlertMigrationDraft: LegacyAlertMigrationDraft;
  readonly legacyAutomationMigrationDraft: LegacyAutomationMigrationDraft;
  readonly assistantRailChat: AssistantRailChatState;
  readonly whatsappRepairFocus: 'auth' | 'groups' | 'permissions';
  readonly whatsappQrPreviewVisible: boolean;
  readonly pendingConfirmation: PendingConfirmation | null;
  readonly dismissedWatchdogIssueIds: readonly string[];
  readonly flowFeedback: {
    readonly tone: UiTone;
    readonly message: string;
  } | null;
}

type CalendarAccessScope = 'group' | 'groupOwner' | 'appOwner';

interface WorkspacePersonView {
  readonly personId: string | null;
  readonly displayName: string;
  readonly whatsappJids: readonly string[];
  readonly globalRoles: readonly PersonRole[];
  readonly privateAssistantAuthorized: boolean;
  readonly ownedGroupJids: readonly string[];
  readonly knownToBot: boolean;
}

interface UxTelemetryEntry {
  readonly telemetryId: string;
  readonly tone: UiTone;
  readonly message: string;
  readonly recordedAt: string;
}

interface PendingConfirmation {
  readonly domain: 'assistant' | 'flow' | 'settings' | 'whatsapp' | 'workspace';
  readonly key: string;
  readonly action: string;
  readonly dataset: ActionDataset;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly tone: UiTone;
}

interface RouteLoadOptions {
  readonly replaceHistory?: boolean;
  readonly backgroundRefresh?: boolean;
  readonly focusMainContent?: boolean;
  readonly raiseOnBackgroundError?: boolean;
}

interface ScrollSnapshot {
  readonly left: number;
  readonly top: number;
}

interface ShellGroupSwitcherState {
  readonly groups: readonly {
    readonly groupJid: string;
    readonly preferredSubject: string;
  }[];
  readonly selectedGroupJid: string;
  readonly selectedLabel: string;
}

interface WeekCalendarDayView {
  readonly dayLabel: WeekDayValue;
  readonly label: string;
  readonly shortLabel: string;
  readonly localDate: string;
  readonly dateLabel: string;
  readonly events: readonly WeekPlannerSnapshot['events'][number][];
  readonly notifications: {
    readonly pendingNotifications: number;
    readonly waitingConfirmationNotifications: number;
    readonly sentNotifications: number;
  };
  readonly isToday: boolean;
}

export class AppShell {
  private root: HTMLElement | null = null;
  private readonly bootstraps = new Map<FrontendTransportMode, WebAppBootstrap>();
  private detachEvents: (() => void) | null = null;
  private activeMode: FrontendTransportMode | null = null;
  private liveRefreshTimer: number | null = null;
  private requestToken = 0;

  private state: AppShellState;

  constructor(
    private readonly createBootstrap: (mode: FrontendTransportMode) => WebAppBootstrap,
    initialMode: FrontendTransportMode,
  ) {
    const search = window.location.search;

    this.state = {
      mode: initialMode,
      previewState: this.readPreviewState(search),
      advancedDetailsEnabled: this.readAdvancedDetailsPreference(search),
      route: '/today',
      screenState: 'loading',
      page: null,
      errorMessage: null,
      liveEvents: [],
      uxTelemetry: readStoredUxTelemetry(),
      lastLoadedAt: null,
      scheduleDraft: {
        eventId: null,
        groupJid: '',
        title: '',
        dayLabel: 'sexta-feira',
        startTime: '18:30',
        durationMinutes: '60',
        notes: '',
      },
      distributionDraft: {
        ruleId: '',
        messageSummary: '',
        urgency: 'normal',
        confirmationMode: 'rule_default',
      },
      mediaDistributionDraft: createEmptyMediaDistributionDraft(),
      groupManagementDraft: createEmptyGroupManagementDraft(),
      workspaceAgentDraft: createEmptyWorkspaceAgentDraft(),
      assistantSchedulingDraft: createEmptyAssistantSchedulingDraft(),
      legacyScheduleMigrationDraft: createEmptyLegacyScheduleMigrationDraft(),
      legacyAlertMigrationDraft: createEmptyLegacyAlertMigrationDraft(),
      legacyAutomationMigrationDraft: createEmptyLegacyAutomationMigrationDraft(),
      assistantRailChat: createInitialAssistantRailChatState(),
      whatsappRepairFocus: 'auth',
      whatsappQrPreviewVisible: false,
      pendingConfirmation: null,
      dismissedWatchdogIssueIds: [],
      flowFeedback: null,
    };
  }

  mount(root: HTMLElement): void {
    this.root = root;
    this.state = {
      ...this.state,
      route: this.currentRouter().normalizeRoute(window.location.pathname),
    };

    window.addEventListener('popstate', this.handlePopState);
    window.addEventListener('keydown', this.handleGlobalKeyDown);
    void this.loadCurrentRoute({ replaceHistory: true });
  }

  private readonly handlePopState = (): void => {
    this.state = {
      ...this.state,
      mode: this.readMode(window.location.search),
      previewState: this.readPreviewState(window.location.search),
      advancedDetailsEnabled: this.readAdvancedDetailsPreference(window.location.search),
      route: this.currentRouter().normalizeRoute(window.location.pathname),
    };
    void this.loadCurrentRoute({ replaceHistory: true });
  };

  private readonly handleGlobalKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.state.pendingConfirmation) {
      event.preventDefault();
      this.dismissPendingConfirmation('Confirmacao cancelada nesta sessao.');
      return;
    }

    if (event.altKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      this.setAdvancedDetailsEnabled(!this.state.advancedDetailsEnabled);
    }
  };

  private setAdvancedDetailsEnabled(enabled: boolean): void {
    this.state = {
      ...this.state,
      advancedDetailsEnabled: enabled,
      pendingConfirmation: null,
      flowFeedback: {
        tone: 'neutral',
        message: enabled
          ? 'Dados avancados visiveis. Vais ver IDs, JIDs e detalhes tecnicos extra.'
          : 'Voltaste ao modo essencial para uma leitura mais limpa.',
      },
    };
    writeStoredAdvancedDetailsPreference(enabled);
    this.recordUxEvent(
      'neutral',
      enabled ? 'Modo de detalhes avancados ligado.' : 'Modo de detalhes avancados desligado.',
    );
    this.syncUrl(true);
    this.render();
  }

  private recordUxEvent(tone: UiTone, message: string): void {
    const nextTelemetry = [
      {
        telemetryId: `ux-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        tone,
        message,
        recordedAt: new Date().toISOString(),
      },
      ...this.state.uxTelemetry,
    ].slice(0, 8);

    this.state = {
      ...this.state,
      uxTelemetry: nextTelemetry,
    };
    writeStoredUxTelemetry(nextTelemetry);
  }

  private dismissPendingConfirmation(message?: string): void {
    this.state = {
      ...this.state,
      pendingConfirmation: null,
      flowFeedback: message
        ? {
            tone: 'neutral',
            message,
          }
        : this.state.flowFeedback,
    };
    this.render();
  }

  private focusMainContent(): void {
    window.requestAnimationFrame(() => {
      this.root?.querySelector<HTMLElement>('#main-content')?.focus();
    });
  }

  private currentRouter(): AppRouter {
    return this.getBootstrap(this.state.mode).router;
  }

  private currentBootstrap(): WebAppBootstrap {
    return this.getBootstrap(this.state.mode);
  }

  private currentClient() {
    return this.currentBootstrap().apiClientProvider.getClient();
  }

  private getAssistantRailPreferredGroupJid(): string | null {
    const groupPage = this.readGroupManagementPageData();
    return groupPage?.data.selectedGroupJid ?? null;
  }

  private async ensureAssistantRailGroups(force = false): Promise<void> {
    if (this.state.assistantRailChat.loadingGroups) {
      return;
    }

    if (!force && this.state.assistantRailChat.availableGroups.length > 0) {
      return;
    }

    this.state = {
      ...this.state,
      assistantRailChat: {
        ...this.state.assistantRailChat,
        loadingGroups: true,
      },
    };
    this.render();

    try {
      const groups = await this.currentClient().listGroups();
      const selectedGroupJid = resolveAssistantRailSelectedGroupJid(
        this.state.assistantRailChat.selectedGroupJid,
        groups,
        this.getAssistantRailPreferredGroupJid(),
      );

      this.state = {
        ...this.state,
        assistantRailChat: {
          ...this.state.assistantRailChat,
          availableGroups: groups,
          loadingGroups: false,
          selectedGroupJid,
        },
      };
    } catch (error) {
      this.state = {
        ...this.state,
        assistantRailChat: {
          ...this.state.assistantRailChat,
          loadingGroups: false,
        },
      };
      this.recordUxEvent('warning', `Grupos do chat lateral indisponiveis: ${summarizeTelemetryMessage(readErrorMessage(error))}.`);
    }

    this.render();
  }

  private appendAssistantRailMessage(
    role: AssistantRailMessage['role'],
    text: string,
    contextLabel: string,
  ): void {
    const nextMessage: AssistantRailMessage = {
      messageId: `rail-chat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role,
      text,
      contextLabel,
      recordedAt: new Date().toISOString(),
    };

    this.state = {
      ...this.state,
      assistantRailChat: {
        ...this.state.assistantRailChat,
        messages: [...this.state.assistantRailChat.messages, nextMessage].slice(-14),
      },
    };
  }

  private async buildAssistantRailChatInput(prompt: string): Promise<{
    readonly input: LlmChatInput;
    readonly contextLabel: string;
  }> {
    const { contextMode, selectedGroupJid, messages, availableGroups } = this.state.assistantRailChat;
    const currentRoute = this.currentRouter().resolveRoute(this.state.route);
    const recentHistory = messages
      .slice(-6)
      .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
      .map((entry) => `${entry.role === 'user' ? 'Utilizador' : 'Assistente'}: ${truncateText(entry.text, 180)}`);

    const contextSummary = [
      'Resposta sempre no chat local da interface web. Nao enviar nada para grupos nem chats privados do WhatsApp.',
      `Pagina atual: ${currentRoute.label}.`,
      `Modo de dados atual: ${this.state.mode}.`,
    ];

    if (recentHistory.length > 0) {
      contextSummary.push(`Historico recente: ${recentHistory.join(' | ')}`);
    }

    if (contextMode === 'group') {
      if (!selectedGroupJid) {
        throw new Error('Escolhe primeiro um grupo para conversar com contexto de grupo.');
      }

      const preview = await this.currentClient().previewGroupContext(selectedGroupJid, {
        text: prompt,
        senderDisplayName: 'Operador LumeHub',
      });

      return {
        contextLabel: buildAssistantRailContextLabel('group', selectedGroupJid, availableGroups, preview),
        input: buildAssistantRailGroupChatInput({
          prompt,
          preview,
          baseContextSummary: contextSummary,
        }),
      };
    }

    return {
      contextLabel: 'Global',
      input: {
        text: prompt,
        intent: 'sidebar_ui_chat',
        contextSummary,
        domainFacts: [
          'Contexto global do operador. Nao assumir um grupo WhatsApp especifico, a nao ser que o utilizador o indique explicitamente.',
        ],
      },
    };
  }

  private getBootstrap(mode: FrontendTransportMode): WebAppBootstrap {
    const bootstrap = this.bootstraps.get(mode) ?? this.createBootstrap(mode);

    if (!this.bootstraps.has(mode)) {
      this.bootstraps.set(mode, bootstrap);
    }

    if (this.activeMode !== mode) {
      this.detachEvents?.();
      this.activeMode = mode;
      this.detachEvents =
        bootstrap.apiClientProvider.getClient().subscribe((event) => {
          this.state = {
            ...this.state,
            liveEvents: [event, ...this.state.liveEvents].slice(0, 6),
          };
          this.render();

          if (shouldAutoRefreshRoute(this.currentRouter().resolveRoute(this.state.route).canonicalRoute, event.topic) && this.state.previewState === 'none') {
            if (this.liveRefreshTimer !== null) {
              window.clearTimeout(this.liveRefreshTimer);
            }

            this.liveRefreshTimer = window.setTimeout(() => {
              this.liveRefreshTimer = null;
              void this.refreshCurrentRouteData({ silent: true });
            }, 220);
          }
        }) ?? null;
    }

    return bootstrap;
  }

  private async loadCurrentRoute(options: RouteLoadOptions = {}): Promise<void> {
    const bootstrap = this.getBootstrap(this.state.mode);
    const route = bootstrap.router.resolveRoute(this.state.route);
    const token = ++this.requestToken;
    const backgroundRefresh = options.backgroundRefresh ?? false;
    const shouldFocusMainContent = options.focusMainContent ?? !backgroundRefresh;

    this.syncUrl(options.replaceHistory ?? false);

    if (this.state.previewState !== 'none') {
      this.state = {
        ...this.state,
        screenState: mapPreviewStateToScreenState(this.state.previewState),
        page: createPreviewPage(route, this.state.previewState),
        errorMessage: this.state.previewState === 'error' ? 'Falha simulada para validar a linguagem do erro.' : null,
        lastLoadedAt: new Date().toISOString(),
      };
      this.recordUxEvent('warning', `Estado de preview ${this.state.previewState} aberto em ${route.label}.`);
      this.render();
      void this.ensureAssistantRailGroups();
      if (shouldFocusMainContent) {
        this.focusMainContent();
      }
      return;
    }

    if (!backgroundRefresh) {
      this.state = {
        ...this.state,
        screenState: 'loading',
        page: null,
        errorMessage: null,
      };
      this.render();
    }

    try {
      const page = await bootstrap.router.renderRoute(route.route);

      if (token !== this.requestToken) {
        return;
      }

      this.state = {
        ...this.state,
        route: route.route,
        screenState: 'ready',
        page,
        errorMessage: null,
        lastLoadedAt: new Date().toISOString(),
      };
      this.syncRouteDraftState(page);
      if (!backgroundRefresh) {
        this.recordUxEvent('positive', `${route.label} carregado em modo ${this.state.mode}.`);
      }
      this.render();
      void this.ensureAssistantRailGroups();
      if (shouldFocusMainContent) {
        this.focusMainContent();
      }
    } catch (error) {
      if (token !== this.requestToken) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);

      if (backgroundRefresh && this.state.page) {
        if (options.raiseOnBackgroundError) {
          this.state = {
            ...this.state,
            errorMessage: message,
            flowFeedback: {
              tone: 'danger',
              message: `Nao foi possivel atualizar esta pagina sem te tirar do ponto onde estavas. ${message}`,
            },
          };
          this.recordUxEvent('danger', `Atualizacao em segundo plano falhou em ${route.label}.`);
          this.render();
          throw error instanceof Error ? error : new Error(message);
        }

        return;
      }

      this.state = {
        ...this.state,
        screenState: looksOffline(message) ? 'offline' : 'error',
        page: null,
        errorMessage: message,
        lastLoadedAt: new Date().toISOString(),
      };
      this.recordUxEvent('danger', `Falha ao abrir ${route.label}: ${summarizeTelemetryMessage(message)}.`);
      this.render();
      if (shouldFocusMainContent) {
        this.focusMainContent();
      }
    }
  }

  private async refreshCurrentRouteData(options: { readonly silent?: boolean } = {}): Promise<void> {
    this.currentBootstrap().queryClient.clear();
    await this.loadCurrentRoute({
      replaceHistory: true,
      backgroundRefresh: true,
      focusMainContent: false,
      raiseOnBackgroundError: !options.silent,
    });
  }

  private syncRouteDraftState(page: UiPage): void {
    if (page.route === '/media') {
      this.syncMediaDistributionDraft(page as UiPage<MediaLibraryPageData>);
    }

    if (page.route === '/groups') {
      this.syncGroupManagementDraft(page as UiPage<GroupManagementPageData>);
    }

    if (page.route === '/assistant') {
      this.syncAssistantSchedulingDraft(page as UiPage<AssistantPageData>);
    }

    if (page.route === '/settings') {
      this.syncSettingsDrafts(page as UiPage<SettingsPageData>);
    }
  }

  private syncMediaDistributionDraft(page: UiPage<MediaLibraryPageData>): void {
    this.state = {
      ...this.state,
      mediaDistributionDraft: resolveMediaDistributionDraft(
        this.state.mediaDistributionDraft,
        page.data.assets,
        page.data.groups,
      ),
    };
  }

  private syncGroupManagementDraft(page: UiPage<GroupManagementPageData>): void {
    const { selectedGroupJid, intelligence, previewText } = page.data;
    const selectedDocument =
      intelligence?.knowledge.documents.find(
        (document) => document.documentId === this.state.groupManagementDraft.selectedDocumentId,
      ) ??
      intelligence?.knowledge.documents[0] ??
      null;

    this.state = {
      ...this.state,
      groupManagementDraft: {
        selectedGroupJid,
        instructions: intelligence?.instructions.content ?? '',
        previewText,
        selectedDocumentId: selectedDocument?.documentId ?? null,
        knowledgeDocument: selectedDocument
          ? mapGroupKnowledgeDocumentToDraft(selectedDocument)
          : createEmptyGroupKnowledgeDraft(),
      },
    };
  }

  private syncAssistantSchedulingDraft(page: UiPage<AssistantPageData>): void {
    const selectedGroupJid = resolveAssistantSchedulingGroupJid(
      this.state.assistantSchedulingDraft.groupJid,
      page.data.groups,
    );

    this.state = {
      ...this.state,
      assistantSchedulingDraft: {
        ...this.state.assistantSchedulingDraft,
        groupJid: selectedGroupJid,
      },
    };
  }

  private syncSettingsDrafts(page: UiPage<SettingsPageData>): void {
    this.state = {
      ...this.state,
      legacyScheduleMigrationDraft: resolveLegacyScheduleMigrationDraft(
        this.state.legacyScheduleMigrationDraft,
        page.data.legacyScheduleImportFiles,
        page.data.legacyScheduleImportReport,
      ),
      legacyAlertMigrationDraft: resolveLegacyAlertMigrationDraft(
        this.state.legacyAlertMigrationDraft,
        page.data.legacyAlertImportReport,
      ),
      legacyAutomationMigrationDraft: resolveLegacyAutomationMigrationDraft(
        this.state.legacyAutomationMigrationDraft,
        page.data.legacyAutomationImportReport,
      ),
    };
  }

  private resolveShellGroupSwitcherState(): ShellGroupSwitcherState | null {
    const page = this.state.page;
    const currentRoute = this.currentRouter().resolveRoute(this.state.route);

    const groups = readRouteGroupOptions(page, this.state.assistantRailChat.availableGroups);

    if (groups.length === 0) {
      return null;
    }

    const preferredSelectedGroupJid =
      currentRoute.canonicalRoute === '/groups'
        ? this.readGroupManagementPageData()?.data.selectedGroupJid ?? null
        : this.state.assistantRailChat.selectedGroupJid;
    const selectedGroup =
      groups.find((group) => group.groupJid === preferredSelectedGroupJid) ??
      groups[0] ??
      null;

    if (!selectedGroup) {
      return null;
    }

    return {
      groups,
      selectedGroupJid: selectedGroup.groupJid,
      selectedLabel: selectedGroup.preferredSubject,
    };
  }

  private render(options: { readonly preserveScroll?: boolean } = {}): void {
    if (!this.root) {
      return;
    }

    const scrollSnapshot = options.preserveScroll === false ? null : this.captureScrollSnapshot();

    const bootstrap = this.getBootstrap(this.state.mode);
    const router = bootstrap.router;
    const currentRoute = router.resolveRoute(this.state.route);
    const navigation = router.navigation();
    const groupSwitcher = this.resolveShellGroupSwitcherState();
    const showAssistantRail = this.shouldRenderAssistantRail(currentRoute);

    document.title = `LumeHub | ${currentRoute.label}`;
    this.root.innerHTML = `
      <a class="skip-link" href="#main-content">Saltar para o conteudo principal</a>
      <div class="app-shell ${showAssistantRail ? '' : 'app-shell--without-rail'}">
        <aside class="shell-nav">
          <section class="surface brand-card">
            <div class="brand-mark">
              <span class="brand-orbit" aria-hidden="true"></span>
              <span>LumeHub</span>
            </div>
          </section>
          <nav class="surface nav-card" aria-label="Navegacao principal">
            <div class="nav-section">
              <p class="nav-section-label">Principal</p>
              ${navigation.primary
                .map(
                  (item) => `
                    <a
                      href="${escapeHtml(item.route)}"
                      data-route="${escapeHtml(item.route)}"
                      class="nav-link ${item.route === currentRoute.canonicalRoute ? 'is-active' : ''}"
                      ${item.route === currentRoute.canonicalRoute ? 'aria-current="page"' : ''}
                    >
                      <span>
                        <span class="nav-link-label">${escapeHtml(item.label)}</span>
                      </span>
                    </a>
                  `,
                )
                .join('')}
            </div>
            ${navigation.secondary.length > 0
              ? `
                <div class="nav-section nav-section--secondary">
                  <p class="nav-section-label">Apoio</p>
                  ${navigation.secondary
                    .map(
                      (item) => `
                        <a
                          href="${escapeHtml(item.route)}"
                          data-route="${escapeHtml(item.route)}"
                          class="nav-link ${item.route === currentRoute.canonicalRoute ? 'is-active' : ''}"
                          ${item.route === currentRoute.canonicalRoute ? 'aria-current="page"' : ''}
                        >
                          <span>
                            <span class="nav-link-label">${escapeHtml(item.label)}</span>
                          </span>
                        </a>
                      `,
                    )
                    .join('')}
                </div>
              `
              : ''}
          </nav>
        </aside>

        <div class="shell-main">
          <header class="surface shell-header surface--strong">
            <div class="header-copy">
              <p class="eyebrow">Runtime live</p>
              <h1>${escapeHtml(currentRoute.label)}</h1>
              <p>${escapeHtml(currentRoute.description)}</p>
            </div>
            <div class="header-meta">
              ${groupSwitcher
                ? `
                  <section class="header-group-switcher" aria-label="Switcher global de grupo">
                    <p class="header-group-switcher__eyebrow">Grupo em foco</p>
                    <strong>${escapeHtml(groupSwitcher.selectedLabel)}</strong>
                    <label class="header-group-switcher__field">
                      <span>Abrir pagina de grupo</span>
                      <select class="ui-control" data-shell-group-switcher>
                        ${groupSwitcher.groups
                          .map(
                            (group) =>
                              `<option value="${escapeHtml(group.groupJid)}"${group.groupJid === groupSwitcher.selectedGroupJid ? ' selected' : ''}>${escapeHtml(group.preferredSubject)}</option>`,
                          )
                          .join('')}
                      </select>
                    </label>
                    <p class="header-group-switcher__hint">Ao trocar aqui, abres logo o workspace desse grupo.</p>
                  </section>
                `
                : ''}
              <div class="status-strip">
                ${renderUiBadge({
                  label: this.state.mode === 'demo' ? 'Preview demo' : 'Ligado live',
                  tone: this.state.mode === 'demo' ? 'warning' : 'positive',
                })}
                ${this.state.screenState !== 'ready'
                  ? renderUiBadge({
                      label: renderScreenStateLabel(this.state.screenState),
                      tone: toneFromScreenState(this.state.screenState),
                    })
                  : ''}
                ${renderUiBadge({ label: `Atualizado ${formatShortDateTime(this.state.lastLoadedAt)}`, tone: 'neutral' })}
              </div>
            </div>
          </header>

          <main class="page-stack" id="main-content" tabindex="-1">
            ${this.state.pendingConfirmation ? this.renderPendingConfirmationCard() : ''}
            ${this.state.flowFeedback ? `<section class="surface flow-feedback flow-feedback--${this.state.flowFeedback.tone}" role="status" aria-live="polite"><p>${escapeHtml(this.state.flowFeedback.message)}</p></section>` : ''}
            ${this.renderMainContent(currentRoute)}
          </main>
        </div>

        ${showAssistantRail
          ? `
            <aside class="shell-rail">
              ${this.renderAssistantRail(currentRoute)}
            </aside>
          `
          : ''}
      </div>
    `;

    this.bindInteractions();
    this.restoreScrollSnapshot(scrollSnapshot);
  }

  private renderPendingConfirmationCard(): string {
    if (!this.state.pendingConfirmation) {
      return '';
    }

    return `
      <section class="surface confirmation-card confirmation-card--${this.state.pendingConfirmation.tone}" role="alertdialog" aria-live="assertive">
        <div>
          <p class="eyebrow">Confirmacao sensivel</p>
          <h3>${escapeHtml(this.state.pendingConfirmation.title)}</h3>
          <p>${escapeHtml(this.state.pendingConfirmation.description)}</p>
        </div>
        <div class="action-row">
          ${renderUiActionButton({
            label: this.state.pendingConfirmation.confirmLabel,
            dataAttributes: { 'confirm-action': 'accept' },
          })}
          ${renderUiActionButton({
            label: 'Cancelar',
            variant: 'secondary',
            dataAttributes: { 'confirm-action': 'cancel' },
          })}
        </div>
      </section>
    `;
  }

  private shouldRenderAssistantRail(currentRoute: ResolvedAppRoute): boolean {
    return currentRoute.canonicalRoute !== '/settings' && currentRoute.canonicalRoute !== '/migration';
  }

  private renderMainContent(currentRoute: ResolvedAppRoute): string {
    if (this.state.screenState === 'loading') {
      return `
        <section class="surface state-card">
          <div class="skeleton">
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="card-grid">
              <div class="skeleton-block"></div>
              <div class="skeleton-block"></div>
              <div class="skeleton-block"></div>
            </div>
          </div>
        </section>
      `;
    }

    if (this.state.screenState === 'offline') {
      return this.renderStateCard(
        'Sem ligacao ao backend',
        this.state.errorMessage ??
          'A app nao conseguiu falar com a API. Podes testar a shell em modo demo enquanto ligamos o backend real.',
        [
          { label: 'Voltar ao demo', value: 'demo', kind: 'mode' },
          { label: 'Mostrar estado normal', value: 'none', kind: 'preview' },
        ],
      );
    }

    if (this.state.screenState === 'error') {
      return this.renderStateCard(
        'Algo falhou ao carregar esta pagina',
        this.state.errorMessage ?? 'Falha nao identificada.',
        [
          { label: 'Tentar de novo', value: 'none', kind: 'preview' },
          { label: 'Usar demo', value: 'demo', kind: 'mode' },
        ],
      );
    }

    if (this.state.screenState === 'empty') {
      return `
        <section class="surface placeholder-card">
          <div>
            <p class="eyebrow">${escapeHtml(currentRoute.label)}</p>
            <h3>Nada para mostrar ainda</h3>
            <p>
              Este estado existe para validar como a shell comunica ausencia de dados sem parecer quebrada ou tecnica demais.
            </p>
          </div>
        </section>
      `;
    }

    if (!this.state.page) {
      return this.renderStateCard('A carregar', 'Ainda estamos a preparar a pagina.', []);
    }

    switch (this.state.page.route) {
      case '/today':
        return this.renderTodayPage(this.state.page as UiPage<DashboardSnapshot>);
      case '/week':
        return this.renderWeekPage(this.state.page as UiPage<WeekPlannerSnapshot>);
      case '/assistant':
        return this.renderAssistantPage(this.state.page as UiPage<AssistantPageData>);
      case '/media':
        return this.renderMediaPage(this.state.page as UiPage<MediaLibraryPageData>);
      case '/workspace':
        return this.renderWorkspacePage(this.state.page as UiPage<WorkspaceAgentPageData>);
      case '/groups':
        return this.renderGroupsPage(this.state.page as UiPage<GroupManagementPageData>);
      case '/whatsapp':
        return this.renderWhatsAppPage(this.state.page as UiPage<WhatsAppManagementPageData>);
      case '/migration':
        return this.renderMigrationPage(this.state.page as UiPage<MigrationPageData>);
      case '/settings':
        return this.renderSettingsPage(this.state.page as UiPage<SettingsPageData>);
      case '/distributions':
        return this.renderRoutingPage(this.state.page as UiPage<RoutingConsoleSnapshot>);
      case '/watchdog':
        return this.renderWatchdogPage(this.state.page as UiPage<readonly WatchdogIssue[]>);
      default:
        return this.renderGenericPage(this.state.page);
    }
  }

  private renderTodayPage(page: UiPage<DashboardSnapshot>): string {
    const snapshot = page.data;
    const readyTone = snapshot.readiness.ready ? 'positive' : 'warning';
    const nextStep =
      snapshot.watchdog.openIssues > 0
        ? 'Comeca por rever as issues abertas do watchdog.'
        : snapshot.whatsapp.phase !== 'open'
          ? 'Abre o WhatsApp e confirma a ligacao da sessao.'
          : snapshot.distributions.running + snapshot.distributions.queued > 0
            ? 'Confirma as distribuicoes em curso antes de criares novas.'
            : 'Segue para a semana e cria o proximo agendamento.';

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Visao de hoje</p>
          <h2>O que esta bem, o que pede atencao e qual e o proximo passo.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({ label: 'Ver WhatsApp', href: '/whatsapp', dataAttributes: { route: '/whatsapp' } })}
            ${renderUiActionButton({ label: 'Abrir semana', href: '/week', variant: 'secondary', dataAttributes: { route: '/week' } })}
          </div>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Pronto para operar',
            badgeLabel: snapshot.readiness.ready ? 'Pronto' : 'Rever',
            badgeTone: readyTone,
            contentHtml: `<p>${escapeHtml(
              snapshot.readiness.ready
                ? 'O sistema parece utilizavel e o host companion esta vivo.'
                : 'Ainda ha sinais a rever antes de confiar plenamente na operacao.',
            )}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Proximo passo recomendado',
            contentHtml: `<p>${escapeHtml(nextStep)}</p>`,
          })}
        </div>
      </section>

      <section class="card-grid">
        ${renderUiMetricCard({ title: 'WhatsApp pronto', value: readableSessionPhase(snapshot.whatsapp.phase), tone: toneForSessionPhase(snapshot.whatsapp.phase), description: 'Estado live da sessao WhatsApp.' })}
        ${renderUiMetricCard({ title: 'Problemas ativos', value: String(snapshot.watchdog.openIssues), tone: snapshot.watchdog.openIssues > 0 ? 'warning' : 'positive', description: 'Issues que merecem acao agora.' })}
        ${renderUiMetricCard({ title: 'Distribuicoes em curso', value: String(snapshot.distributions.running + snapshot.distributions.queued), tone: snapshot.distributions.running > 0 ? 'warning' : 'neutral', description: 'Campanhas a correr ou em espera.' })}
        ${renderUiMetricCard({ title: 'Grupos prontos', value: `${snapshot.groups.withOwners}/${snapshot.groups.total}`, tone: 'neutral', description: 'Grupos com owner definido e prontos para operar.' })}
      </section>

      <section class="content-grid">
        <article class="surface content-card span-7">
          <div class="card-header">
            <h3>O que merece atencao agora</h3>
            ${renderUiBadge({
              label: snapshot.watchdog.openIssues > 0 ? 'Agir agora' : 'Tudo sob controlo',
              tone: snapshot.watchdog.openIssues > 0 ? 'warning' : 'positive',
            })}
          </div>
          <ul>
            ${
              snapshot.watchdog.recentIssues.length > 0
                ? snapshot.watchdog.recentIssues
                    .slice(0, 3)
                    .map(
                      (issue) =>
                        `<li><strong>${escapeHtml(issue.groupLabel)}</strong>: ${escapeHtml(issue.summary)}</li>`,
                    )
                    .join('')
                : '<li>Sem issues abertas neste momento.</li>'
            }
            <li>${snapshot.distributions.queued} distribuicoes em fila e ${snapshot.distributions.running} a correr.</li>
            <li>${snapshot.distributions.partialFailed} com falha parcial e ${snapshot.distributions.failed} falhadas.</li>
          </ul>
        </article>

        <article class="surface content-card span-5">
          <div class="card-header">
            <h3>Atalhos principais</h3>
            ${renderUiBadge({ label: 'Uso diario', tone: 'positive' })}
          </div>
          <div class="card-grid">
            ${renderUiRecordCard({
              title: 'Criar agendamento',
              subtitle: 'Abrir a semana e preparar a proxima aula.',
              badgeLabel: 'Semana',
              badgeTone: 'positive',
              bodyHtml: `<div class="action-row">${renderUiActionButton({ label: 'Abrir semana', href: '/week', dataAttributes: { route: '/week' } })}</div>`,
            })}
            ${renderUiRecordCard({
              title: 'Distribuir mensagem',
              subtitle: 'Preparar e confirmar o proximo envio.',
              badgeLabel: 'Distribuicoes',
              badgeTone: 'warning',
              bodyHtml: `<div class="action-row">${renderUiActionButton({ label: 'Abrir distribuicoes', href: '/distributions', dataAttributes: { route: '/distributions' } })}</div>`,
            })}
            ${renderUiRecordCard({
              title: 'Rever WhatsApp',
              subtitle: 'Confirmar ligacao, grupos e QR quando fizer falta.',
              badgeLabel: readableSessionPhase(snapshot.whatsapp.phase),
              badgeTone: toneForSessionPhase(snapshot.whatsapp.phase),
              bodyHtml: `<div class="action-row">${renderUiActionButton({ label: 'Abrir WhatsApp', href: '/whatsapp', dataAttributes: { route: '/whatsapp' } })}</div>`,
            })}
          </div>
        </article>
      </section>
    `;
  }

  private renderWeekPage(page: UiPage<WeekPlannerSnapshot>): string {
    const groups = page.data.groups;
    const draft = resolveScheduleDraft(this.state.scheduleDraft, groups);
    const selectedGroup = groups.find((group) => group.groupJid === draft.groupJid) ?? null;
    const editingEvent = page.data.events.find((event) => event.eventId === draft.eventId) ?? null;
    const weekDays = buildWeekCalendarDays(page.data);
    const occupiedDays = weekDays.filter((day) => day.events.length > 0).length;
    const busiestDay = weekDays.reduce<WeekCalendarDayView | null>(
      (best, day) => (!best || day.events.length > best.events.length ? day : best),
      null,
    );
    const notificationLabels = page.data.defaultNotificationRuleLabels.length > 0
      ? page.data.defaultNotificationRuleLabels
      : ['24h antes', '30 min antes'];
    const examples = groups.slice(0, 3).map((group, index) => ({
      key: group.groupJid,
      title: index === 0 ? 'Aula regular' : index === 1 ? 'Reposicao' : 'Sessao especial',
      notes:
        index === 0
          ? 'Mantem o horario habitual e replica os avisos default.'
          : index === 1
            ? 'Usa este exemplo para mover ou reforcar uma aula ja prevista.'
            : 'Bom para eventos pontuais, ensaios ou comunicados com hora marcada.',
      preview: buildScheduleExample(group, index),
    }));

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Calendario semanal</p>
          <h2>A semana passa a ser a vista principal para criar, rever e ajustar notificacoes reais.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({
              label: editingEvent ? 'Guardar alteracoes' : 'Criar notificacao',
              dataAttributes: { 'flow-action': 'schedule-save' },
            })}
            ${renderUiActionButton({
              label: 'Limpar editor',
              variant: 'secondary',
              dataAttributes: { 'flow-action': 'schedule-clear' },
            })}
          </div>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Semana em foco',
            badgeLabel: page.data.focusWeekLabel,
            badgeTone: 'neutral',
            contentHtml: `<p>${escapeHtml(`${page.data.focusWeekRangeLabel}. Timezone ${page.data.timezone}. ${groups.length} grupos visiveis nesta operacao semanal.`)}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Leitura rapida da semana',
            badgeLabel: `${page.data.diagnostics.eventCount} notificacoes`,
            badgeTone: page.data.diagnostics.eventCount > 0 ? 'positive' : 'neutral',
            contentHtml: `<p>${escapeHtml(
              occupiedDays > 0
                ? `${occupiedDays} dia(s) ocupados. Pico em ${busiestDay?.label ?? 'sem dia dominante'} com ${busiestDay?.events.length ?? 0} notificacao(oes).`
                : 'Ainda nao ha notificacoes planeadas nesta semana.',
            )}</p>`,
          })}
        </div>
      </section>

      <section class="card-grid">
        ${renderUiMetricCard({
          title: 'pending',
          value: String(page.data.diagnostics.pendingNotifications),
          tone: page.data.diagnostics.pendingNotifications > 0 ? 'neutral' : 'positive',
          description: 'Notificacoes materializadas e ainda por enviar.',
        })}
        ${renderUiMetricCard({
          title: 'waiting_confirmation',
          value: String(page.data.diagnostics.waitingConfirmationNotifications),
          tone: page.data.diagnostics.waitingConfirmationNotifications > 0 ? 'warning' : 'positive',
          description: 'Tentativas que ainda esperam confirmacao forte.',
        })}
        ${renderUiMetricCard({
          title: 'sent',
          value: String(page.data.diagnostics.sentNotifications),
          tone: page.data.diagnostics.sentNotifications > 0 ? 'positive' : 'neutral',
          description: 'Notificacoes ja observadas como fechadas.',
        })}
        ${renderUiMetricCard({
          title: 'Dias ocupados',
          value: `${occupiedDays}/7`,
          tone: occupiedDays > 0 ? 'positive' : 'neutral',
          description: 'Dias com pelo menos uma notificacao nesta semana.',
        })}
      </section>

      <section class="surface content-card">
        <div class="card-header">
          <div>
            <h3>Semana operacional</h3>
            <p class="week-section-note">Cada coluna representa um dia real da semana ISO em foco. Cria, edita ou desativa sem sair desta vista.</p>
          </div>
          ${renderUiBadge({
            label: `${page.data.diagnostics.eventCount} notificacao(oes)`,
            tone: page.data.diagnostics.eventCount > 0 ? 'positive' : 'neutral',
          })}
        </div>
        <div class="week-calendar" data-week-calendar>
          ${weekDays
            .map(
              (day) => `
                <section class="week-calendar__day${day.isToday ? ' week-calendar__day--today' : ''}" data-week-day="${day.dayLabel}">
                  <div class="week-calendar__day-header">
                    <div>
                      <p class="week-calendar__eyebrow">${escapeHtml(`${day.shortLabel} · ${day.dateLabel}`)}</p>
                      <h4>${escapeHtml(day.label)}</h4>
                    </div>
                    ${renderUiBadge({
                      label: day.events.length > 0 ? `${day.events.length} evento(s)` : 'Livre',
                      tone: day.events.length > 0 ? 'positive' : 'neutral',
                    })}
                  </div>
                  <div class="week-calendar__day-meta">
                    ${renderUiBadge({ label: `pending ${day.notifications.pendingNotifications}`, tone: day.notifications.pendingNotifications > 0 ? 'neutral' : 'positive', style: 'chip' })}
                    ${renderUiBadge({
                      label: `waiting_confirmation ${day.notifications.waitingConfirmationNotifications}`,
                      tone: day.notifications.waitingConfirmationNotifications > 0 ? 'warning' : 'neutral',
                      style: 'chip',
                    })}
                    ${renderUiBadge({ label: `sent ${day.notifications.sentNotifications}`, tone: day.notifications.sentNotifications > 0 ? 'positive' : 'neutral', style: 'chip' })}
                  </div>
                  <div class="action-row week-calendar__day-actions">
                    ${renderUiActionButton({
                      label: 'Novo neste dia',
                      variant: 'secondary',
                      dataAttributes: {
                        'flow-action': 'schedule-compose-day',
                        'flow-value': day.dayLabel,
                      },
                    })}
                  </div>
                  <div class="week-calendar__events">
                    ${
                      day.events.length > 0
                        ? day.events
                            .map((event) => renderWeekCalendarEventCard(event, draft.eventId === event.eventId))
                            .join('')
                        : `
                          <div class="week-calendar__empty">
                            <p>Sem notificacoes planeadas neste dia.</p>
                            <p>Usa o botao acima para abrir o editor ja neste dia.</p>
                          </div>
                        `
                    }
                  </div>
                </section>
              `,
            )
            .join('')}
        </div>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-7">
          <div class="card-header">
            <h3>${editingEvent ? 'Editar notificacao' : 'Nova notificacao'}</h3>
            ${renderUiBadge({
              label: editingEvent ? 'Edicao live' : `Dia em foco: ${readableWeekDayLabel(draft.dayLabel)}`,
              tone: editingEvent || selectedGroup ? 'positive' : 'warning',
            })}
          </div>
          <div class="week-editor" data-week-editor>
            <div class="ui-form-grid">
              ${renderUiSelectField({
                label: 'Grupo',
                value: draft.groupJid,
                dataKey: 'schedule.groupJid',
                options: groups.map((group) => ({
                  value: group.groupJid,
                  label: group.preferredSubject,
                })),
                hint: 'Escolhe o grupo sem precisares de ver JIDs.',
              })}
              ${renderUiInputField({
                label: 'Titulo',
                value: draft.title,
                dataKey: 'schedule.title',
                placeholder: 'Ex.: Aula aberta de sexta',
                hint: 'Usa um titulo humano e curto.',
              })}
              ${renderUiSelectField({
                label: 'Dia',
                value: draft.dayLabel,
                dataKey: 'schedule.dayLabel',
                options: WEEK_DAY_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
                hint: 'Tambem podes abrir este editor a partir de cada coluna do calendario.',
              })}
              ${renderUiInputField({
                label: 'Hora',
                value: draft.startTime,
                dataKey: 'schedule.startTime',
                type: 'time',
              })}
              ${renderUiSelectField({
                label: 'Duracao',
                value: draft.durationMinutes,
                dataKey: 'schedule.durationMinutes',
                options: [
                  { value: '45', label: '45 minutos' },
                  { value: '60', label: '60 minutos' },
                  { value: '75', label: '75 minutos' },
                  { value: '90', label: '90 minutos' },
                ],
              })}
              ${renderUiTextAreaField({
                label: 'Notas para a equipa',
                value: draft.notes,
                dataKey: 'schedule.notes',
                rows: 4,
                placeholder: 'Ex.: levar material de ensaio e confirmar sala 2.',
                hint: 'Esta nota aparece no calendario para reveres rapidamente a intencao.',
              })}
            </div>
            <div class="week-editor__summary">
              <p><strong>Grupo</strong>: ${escapeHtml(selectedGroup?.preferredSubject ?? 'Escolhe um grupo')}</p>
              <p><strong>Quando</strong>: ${escapeHtml(`${readableWeekDayLabel(draft.dayLabel)}, ${draft.startTime}`)}</p>
              <p><strong>Duracao</strong>: ${escapeHtml(`${draft.durationMinutes} minutos`)}</p>
              <p><strong>Owners</strong>: ${escapeHtml(
                selectedGroup
                  ? selectedGroup.ownerLabels.length > 0
                    ? selectedGroup.ownerLabels.join(', ')
                    : 'sem owner definido'
                  : 'sem owner definido',
              )}</p>
              <p><strong>Mensagem interna</strong>: ${escapeHtml(draft.notes || 'Sem nota adicional.')}</p>
              <div class="ui-card__chips">
                ${notificationLabels.map((label) => renderUiBadge({ label, tone: 'positive', style: 'chip' })).join('')}
              </div>
            </div>
          </div>
        </article>

        <article class="surface content-card span-5">
          <div class="card-header">
            <h3>Apoio rapido</h3>
            ${renderUiBadge({ label: 'Operacao diaria', tone: 'positive' })}
          </div>
          <div class="week-editor">
            <div class="week-editor__section">
              <p class="week-section-note">Estados canonicos visiveis no calendario.</p>
              <ul class="week-state-legend">
                <li><strong>pending</strong>: notificacao preparada e ainda sem envio fechado.</li>
                <li><strong>waiting_confirmation</strong>: houve tentativa e o sistema esta a aguardar confirmacao forte.</li>
                <li><strong>sent</strong>: o envio ja foi observado como concluido.</li>
              </ul>
            </div>
            <div class="week-editor__section">
              <p class="week-section-note">Bases rapidas para preencher o editor num clique.</p>
              <div class="card-grid">
                ${examples
                  .map((example) =>
                    renderUiRecordCard({
                      title: example.title,
                      subtitle: example.notes,
                      badgeLabel: readableWeekDayLabel(example.preview.dayLabel),
                      badgeTone: 'neutral',
                      bodyHtml: `
                        <ul>
                          <li>Grupo: ${escapeHtml(example.preview.groupLabel)}</li>
                          <li>Hora: ${escapeHtml(example.preview.startTime)}</li>
                          <li>Duracao: ${escapeHtml(example.preview.durationMinutes)} min</li>
                        </ul>
                        <div class="action-row">
                          ${renderUiActionButton({
                            label: 'Usar como base',
                            variant: 'secondary',
                            dataAttributes: {
                              'flow-action': 'schedule-load-example',
                              'flow-value': example.key,
                            },
                          })}
                        </div>
                      `,
                    }),
                  )
                  .join('')}
              </div>
            </div>
            <div class="week-editor__section">
              <p class="week-section-note">Como operar esta vista sem te perderes.</p>
              <ul>
                <li>Clica em Novo neste dia para abrir o editor logo no dia certo.</li>
                <li>Os cartoes da semana deixam-te editar e desativar sem sair da pagina.</li>
                <li>O storage continua mensal por grupo; aqui so vemos a projection semanal live.</li>
              </ul>
            </div>
          </div>
        </article>
      </section>
    `;
  }

  private renderAssistantPage(page: UiPage<AssistantPageData>): string {
    const draft = resolveAssistantSchedulingDraft(this.state.assistantSchedulingDraft, page.data.groups);
    const selectedGroup = page.data.groups.find((group) => group.groupJid === draft.groupJid) ?? null;
    const preview = draft.preview;
    const canApply = Boolean(preview?.canApply && preview.previewFingerprint);
    const latestAudit = page.data.recentSchedulingAudit[0] ?? null;

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Assistente live</p>
          <h2>Pedir uma alteracao em linguagem natural, ver o preview e so depois aplicar na agenda real.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({
              label: draft.previewLoading ? 'A gerar preview...' : 'Gerar preview',
              disabled: draft.previewLoading || draft.applying,
              dataAttributes: { 'assistant-action': 'preview-schedule' },
            })}
            ${renderUiActionButton({
              label: draft.applying ? 'A aplicar...' : 'Aplicar alteracao',
              variant: 'secondary',
              disabled: !canApply || draft.previewLoading || draft.applying,
              dataAttributes: { 'assistant-action': 'apply-schedule' },
            })}
            ${renderUiActionButton({
              label: 'Limpar pedido',
              variant: 'secondary',
              dataAttributes: { 'assistant-action': 'clear-schedule' },
            })}
          </div>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'LLM em uso',
            badgeLabel: page.data.settings.llmRuntime.effectiveProviderId,
            badgeTone: page.data.settings.llmRuntime.mode === 'live' ? 'positive' : 'warning',
            contentHtml: `<p>${escapeHtml(
              `${page.data.settings.llmRuntime.effectiveProviderId} / ${page.data.settings.llmRuntime.effectiveModelId}`,
            )}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Ultima alteracao',
            badgeLabel: latestAudit ? readableInstructionStatus(latestAudit.status) : 'Sem auditoria',
            badgeTone: latestAudit ? toneForInstructionStatus(latestAudit.status) : 'neutral',
            contentHtml: `<p>${escapeHtml(
              latestAudit
                ? `${latestAudit.groupLabel ?? latestAudit.groupJid ?? 'Grupo'} • ${latestAudit.previewSummary}`
                : 'Assim que aplicares um pedido, a ultima alteracao aparece aqui.',
            )}</p>`,
          })}
        </div>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-7">
          <div class="card-header">
            <div>
              <h3>Pedir mudanca na agenda</h3>
              <p>Escreve como escreverias num chat: criar, mudar ou apagar uma aula/evento.</p>
            </div>
            ${renderUiBadge({
              label: selectedGroup ? selectedGroup.preferredSubject : 'Escolher grupo',
              tone: selectedGroup ? 'positive' : 'warning',
            })}
          </div>
          <div class="ui-form-grid">
            ${renderUiSelectField({
              label: 'Grupo',
              value: draft.groupJid,
              dataKey: 'assistant.groupJid',
              options: page.data.groups.map((group) => ({
                value: group.groupJid,
                label: group.preferredSubject,
              })),
              hint: 'O preview e o apply correm sempre dentro do grupo escolhido.',
            })}
            ${renderUiTextAreaField({
              label: 'Pedido em linguagem natural',
              value: draft.text,
              dataKey: 'assistant.text',
              rows: 8,
              placeholder: 'Ex.: Move a Aula 1 de sexta para sabado as 10:00 e deixa nota para levar figurinos.',
              hint: 'Primeiro sai um preview com diff e resumo. O apply real pede confirmacao.',
            })}
          </div>
          <div class="guide-preview">
            <p><strong>Grupo em foco</strong>: ${escapeHtml(selectedGroup?.preferredSubject ?? 'Escolhe primeiro um grupo.')}</p>
            <p><strong>Acesso pedido</strong>: Ver e editar calendario</p>
            <p><strong>Estado do preview</strong>: ${escapeHtml(
              draft.previewLoading ? 'a gerar preview' : preview ? preview.summary : 'sem preview ainda',
            )}</p>
          </div>
        </article>

        <article class="surface content-card span-5">
          <div class="card-header">
            <div>
              <h3>Preview antes de aplicar</h3>
              <p>Confirma a operacao, o alvo e as diferencas antes de mexer na agenda real.</p>
            </div>
            ${renderUiBadge({
              label: preview
                ? preview.canApply
                  ? 'Pronto a aplicar'
                  : 'Bloqueado'
                : 'Sem preview',
              tone: preview ? (preview.canApply ? 'positive' : 'warning') : 'neutral',
            })}
          </div>
          ${
            preview
              ? `
                <div class="guide-preview">
                  <p><strong>Operacao</strong>: ${escapeHtml(readableAssistantOperation(preview.operation))}</p>
                  <p><strong>Grupo</strong>: ${escapeHtml(preview.groupLabel ?? preview.groupJid ?? 'Sem grupo')}</p>
                  <p><strong>Semana</strong>: ${escapeHtml(preview.weekId ?? 'Sem semana')}</p>
                  <p><strong>Resumo</strong>: ${escapeHtml(preview.summary)}</p>
                  ${
                    preview.blockingReason
                      ? `<p><strong>Bloqueio</strong>: ${escapeHtml(preview.blockingReason)}</p>`
                      : ''
                  }
                </div>
                ${
                  preview.diff.length > 0
                    ? `
                      <div class="timeline">
                        ${preview.diff
                          .map(
                            (entry) => `
                              <article class="timeline-item">
                                <strong>${escapeHtml(entry.label)}</strong>
                                <p>Antes: ${escapeHtml(entry.before ?? 'vazio')}</p>
                                <p>Depois: ${escapeHtml(entry.after ?? 'vazio')}</p>
                              </article>
                            `,
                          )
                          .join('')}
                      </div>
                    `
                    : '<p>Este preview ainda nao mostrou diferencas concretas.</p>'
                }
              `
              : `
                <div class="timeline-item">
                  <strong>Sem preview ainda</strong>
                  <time>Escreve o pedido e carrega em "Gerar preview" para ver a alteracao antes de aplicar.</time>
                </div>
              `
          }
          ${
            draft.lastApplied
              ? `
                <details class="ui-details" open>
                  <summary>Ultimo apply desta sessao</summary>
                  <div class="ui-details__content">
                    <p><strong>Instruction</strong>: ${escapeHtml(draft.lastApplied.instruction.instructionId)}</p>
                    <p><strong>Resultado</strong>: ${escapeHtml(
                      draft.lastApplied.appliedEvent
                        ? `${draft.lastApplied.appliedEvent.title} atualizado na agenda.`
                        : draft.lastApplied.appliedInstruction?.status ?? 'sem estado',
                    )}</p>
                  </div>
                </details>
              `
              : ''
          }
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-7">
          <div class="card-header">
            <div>
              <h3>Auditoria recente do scheduling</h3>
              <p>Fila e alteracoes mais recentes aplicadas a partir do assistente.</p>
            </div>
            ${renderUiBadge({
              label: `${page.data.recentSchedulingAudit.length} entrada${page.data.recentSchedulingAudit.length === 1 ? '' : 's'}`,
              tone: page.data.recentSchedulingAudit.length > 0 ? 'positive' : 'neutral',
            })}
          </div>
          ${
            page.data.recentSchedulingAudit.length > 0
              ? `
                <div class="timeline">
                  ${page.data.recentSchedulingAudit
                    .map(
                      (entry) => `
                        <article class="timeline-item">
                          <strong>${escapeHtml(entry.groupLabel ?? entry.groupJid ?? 'Grupo')}</strong>
                          <time>${escapeHtml(`${readableAssistantOperation(entry.operation)} • ${formatShortDateTime(entry.updatedAt)}`)}</time>
                          <p>${escapeHtml(entry.previewSummary)}</p>
                          <ul>
                            <li>Pedido: ${escapeHtml(entry.requestedText)}</li>
                            <li>Estado: ${escapeHtml(readableInstructionStatus(entry.status))}</li>
                            ${
                              entry.appliedEventTitle
                                ? `<li>Evento aplicado: ${escapeHtml(entry.appliedEventTitle)}</li>`
                                : ''
                            }
                            ${
                              entry.resultNote
                                ? `<li>Nota: ${escapeHtml(entry.resultNote)}</li>`
                                : ''
                            }
                          </ul>
                        </article>
                      `,
                    )
                    .join('')}
                </div>
              `
              : `
                <div class="timeline-item">
                  <strong>Sem alteracoes ainda</strong>
                  <time>Assim que aplicares um pedido de scheduling, ele aparece aqui com auditoria.</time>
                </div>
              `
          }
        </article>

        <article class="surface content-card span-5">
          <div class="card-header">
            <div>
              <h3>Contexto e runs recentes</h3>
              <p>Sinais curtos para perceber se a LLM e a memoria de grupo estao a ser usadas como esperado.</p>
            </div>
            ${renderUiBadge({ label: 'Live', tone: 'positive' })}
          </div>
          <div class="timeline">
            ${
              page.data.recentLlmRuns.length > 0
                ? page.data.recentLlmRuns
                    .slice(0, 3)
                    .map(
                      (entry) => `
                        <article class="timeline-item">
                          <strong>${escapeHtml(entry.providerId)} / ${escapeHtml(entry.modelId)}</strong>
                          <time>${escapeHtml(formatShortDateTime(entry.createdAt))}</time>
                          <p>${escapeHtml(entry.outputSummary)}</p>
                        </article>
                      `,
                    )
                    .join('')
                : `
                    <article class="timeline-item">
                      <strong>Sem runs LLM recentes</strong>
                      <time>Quando houver parsing ou respostas live, elas aparecem aqui.</time>
                    </article>
                  `
            }
            ${
              page.data.recentConversationAudit.length > 0
                ? page.data.recentConversationAudit
                    .slice(0, 2)
                    .map(
                      (entry) => `
                        <article class="timeline-item">
                          <strong>${escapeHtml(entry.intent)}</strong>
                          <time>${escapeHtml(formatShortDateTime(entry.createdAt))}</time>
                          <p>${escapeHtml(describeAssistantConversationMemory(entry))}</p>
                        </article>
                      `,
                    )
                    .join('')
                : ''
            }
          </div>
        </article>
      </section>
    `;
  }

  private renderMediaPage(page: UiPage<MediaLibraryPageData>): string {
    const assets = page.data.assets;
    const groups = page.data.groups;
    const mediaInstructions = page.data.instructions;
    const draft = resolveMediaDistributionDraft(this.state.mediaDistributionDraft, assets, groups);
    const latestAsset = assets[0] ?? null;
    const selectedAsset = assets.find((asset) => asset.assetId === draft.assetId) ?? null;
    const videoAssets = assets.filter((asset) => asset.mediaType === 'video');
    const selectedGroups = groups.filter((group) => draft.targetGroupJids.includes(group.groupJid));
    const allGroupsSelected = groups.length > 0 && selectedGroups.length === groups.length;
    const recentInstructions = mediaInstructions.slice(0, 5);
    const selectableAssets = videoAssets.length > 0 ? videoAssets : assets;

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Biblioteca operacional</p>
          <h2>Escolher um video recebido e espalha-lo pelos grupos certos sem entrar em detalhes tecnicos.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({
              label: 'Abrir WhatsApp',
              href: '/whatsapp',
              dataAttributes: { route: '/whatsapp' },
            })}
            ${renderUiActionButton({
              label: 'Voltar a hoje',
              href: '/today',
              variant: 'secondary',
              dataAttributes: { route: '/today' },
            })}
          </div>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Ultimo asset recebido',
            badgeLabel: latestAsset ? readableMediaType(latestAsset.mediaType) : 'Sem media',
            badgeTone: latestAsset ? 'positive' : 'warning',
            contentHtml: `<p>${escapeHtml(
              latestAsset
                ? `${latestAsset.caption ?? 'Sem caption.'} Origem: ${readableSourceChat(latestAsset.sourceChatJid)}`
                : 'Ainda nao entrou media nesta biblioteca operacional.',
            )}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Pronto para o proximo envio',
            badgeLabel: selectedAsset && selectedGroups.length > 0 ? 'Pronto' : 'Faltam escolhas',
            badgeTone: selectedAsset && selectedGroups.length > 0 ? 'positive' : 'warning',
            contentHtml: `<p>${escapeHtml(
              selectedAsset && selectedGroups.length > 0
                ? `Ja tens ${selectedGroups.length} grupo(s) marcado(s) para receber este asset.`
                : 'Primeiro escolhe um video e pelo menos um grupo para o envio ficar pronto.',
            )}</p>`,
          })}
        </div>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-5">
          <div class="card-header">
            <h3>Escolher video recebido</h3>
            ${renderUiBadge({
              label: selectedAsset ? 'Video pronto' : 'Falta escolher video',
              tone: selectedAsset ? 'positive' : 'warning',
            })}
          </div>
          ${
            assets.length > 0
              ? `
                <div class="ui-form-grid">
                  ${renderUiSelectField({
                    label: videoAssets.length > 0 ? 'Video recebido' : 'Asset recebido',
                    value: draft.assetId ?? '',
                    dataKey: 'media.assetId',
                    options: selectableAssets.map((asset) => ({
                      value: asset.assetId,
                      label: `${readableMediaType(asset.mediaType)} • ${asset.caption ?? readableSourceChat(asset.sourceChatJid)}`,
                    })),
                    hint: 'Escolhe o ficheiro que queres reaproveitar neste envio.',
                  })}
                </div>
                ${
                  selectedAsset
                    ? `
                      <div class="guide-preview">
                        <p><strong>Origem</strong>: ${escapeHtml(readableSourceChat(selectedAsset.sourceChatJid))}</p>
                        <p><strong>Recebido</strong>: ${escapeHtml(formatShortDateTime(selectedAsset.storedAt))}</p>
                        <p><strong>Tipo</strong>: ${escapeHtml(readableMediaType(selectedAsset.mediaType))} • ${escapeHtml(selectedAsset.mimeType)}</p>
                        <p><strong>Tamanho</strong>: ${escapeHtml(formatFileSize(selectedAsset.fileSize))}</p>
                      </div>
                    `
                    : ''
                }
                <div class="timeline">
                  ${selectableAssets
                    .slice(0, 4)
                    .map(
                      (asset) => `
                        <article class="timeline-item">
                          <strong>${escapeHtml(asset.caption ?? `${readableMediaType(asset.mediaType)} sem caption`)}</strong>
                          <time>${escapeHtml(`${readableSourceChat(asset.sourceChatJid)} • ${formatShortDateTime(asset.storedAt)}`)}</time>
                          <p>${escapeHtml(`${readableMediaType(asset.mediaType)} • ${formatFileSize(asset.fileSize)} • ${asset.exists ? 'guardado' : 'em falta'}`)}</p>
                          <div class="action-row">
                            ${renderUiActionButton({
                              label: asset.assetId === draft.assetId ? 'Video em uso' : 'Usar este video',
                              variant: asset.assetId === draft.assetId ? 'secondary' : 'primary',
                              dataAttributes: {
                                'flow-action': 'media-select-asset',
                                'flow-value': asset.assetId,
                              },
                            })}
                          </div>
                        </article>
                      `,
                    )
                    .join('')}
                </div>
              `
              : `
                <div class="timeline-item">
                  <strong>Sem media ainda</strong>
                  <time>Envia um video, imagem ou documento para o bot e volta aqui para confirmar a ingestao.</time>
                </div>
              `
          }
        </article>

        <article class="surface content-card span-7">
          <div class="card-header">
            <h3>Destino e envio</h3>
            ${renderUiBadge({
              label: `${selectedGroups.length}/${groups.length} grupos`,
              tone: selectedGroups.length > 0 ? 'positive' : 'warning',
            })}
          </div>
          ${
            groups.length > 0
              ? `
                <div class="action-row">
                  ${renderUiSwitch({
                    label: 'Master switch dos grupos deste envio',
                    checked: allGroupsSelected,
                    description: allGroupsSelected
                      ? 'Neste momento todos os grupos desta lista vao receber o video.'
                      : 'Liga para selecionar todos de uma vez, ou usa os switches individuais.',
                    dataAttributes: {
                      'flow-action': 'media-toggle-all-groups',
                    },
                  })}
                </div>
                <div class="card-grid">
                  ${groups
                    .map((group) =>
                      renderUiSwitch({
                        label: group.preferredSubject,
                        checked: draft.targetGroupJids.includes(group.groupJid),
                        description: group.aliases.length > 0
                          ? `${group.aliases.join(', ')}${group.groupOwners.length > 0 ? ` • ${group.groupOwners.length} owner(s)` : ''}`
                          : group.groupOwners.length > 0
                            ? `${group.groupOwners.length} owner(s) associados`
                            : 'Sem aliases nem owners mapeados',
                        dataAttributes: {
                          'flow-action': 'media-toggle-group',
                          'flow-value': group.groupJid,
                        },
                      }),
                    )
                    .join('')}
                </div>
                <div class="ui-form-grid">
                  ${renderUiTextAreaField({
                    label: 'Caption para distribuir',
                    value: draft.caption,
                    dataKey: 'media.caption',
                    rows: 4,
                    placeholder: 'Ex.: Video da coreografia final. Confirmem rececao no grupo.',
                    hint: 'Se precisares, ajusta aqui o texto que vai acompanhar o video.',
                  })}
                </div>
                <div class="guide-preview">
                  <p><strong>Video</strong>: ${escapeHtml(
                    selectedAsset?.caption ?? (selectedAsset ? `${readableMediaType(selectedAsset.mediaType)} sem caption` : 'Escolhe primeiro um video'),
                  )}</p>
                  <p><strong>Caption final</strong>: ${escapeHtml(draft.caption || 'Sem caption adicional. O asset vai seguir sem texto extra.')}</p>
                  <p><strong>Grupos alvo</strong>: ${escapeHtml(
                    selectedGroups.length > 0
                      ? selectedGroups.map((group) => group.preferredSubject).join(', ')
                      : 'Ainda nao escolheste grupos.',
                  )}</p>
                </div>
                <div class="action-row">
                  ${renderUiActionButton({
                    label: 'Criar dry run',
                    dataAttributes: { 'flow-action': 'media-distribute-dry-run' },
                  })}
                  ${renderUiActionButton({
                    label: 'Distribuir agora',
                    variant: 'secondary',
                    dataAttributes: { 'flow-action': 'media-distribute-confirmed' },
                  })}
                  ${renderUiActionButton({
                    label: 'Limpar fluxo',
                    variant: 'secondary',
                    dataAttributes: { 'flow-action': 'media-clear' },
                  })}
                </div>
              `
              : `
                <div class="timeline-item">
                  <strong>Sem grupos conhecidos</strong>
                  <time>Quando o runtime descobrir ou mapeares grupos, este passo passa a ficar disponivel.</time>
                </div>
              `
          }
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-12">
          <div class="card-header">
            <div>
              <h3>Ultimos envios de media</h3>
              <p>Historico curto para perceber logo o que entregou, o que falhou e o que ainda esta a correr.</p>
            </div>
            ${renderUiBadge({
              label: `${recentInstructions.length} run${recentInstructions.length === 1 ? '' : 's'}`,
              tone: recentInstructions.length > 0 ? 'positive' : 'warning',
            })}
          </div>
          ${
            recentInstructions.length > 0
              ? `
                <div class="timeline">
                  ${recentInstructions
                    .map((instruction) => {
                      const payload = readMediaInstructionPayload(instruction);
                      const asset = payload ? assets.find((candidate) => candidate.assetId === payload.assetId) ?? null : null;
                      const failedActions = instruction.actions.filter((action) => action.status === 'failed');
                      const pendingActions = instruction.actions.filter(
                        (action) => action.status === 'pending' || action.status === 'running',
                      );

                      return `
                        <article class="timeline-item">
                          <strong>${escapeHtml(payload?.caption ?? asset?.caption ?? 'Distribuicao de video sem caption')}</strong>
                          <time>${escapeHtml(`${instruction.mode === 'confirmed' ? 'Envio confirmado' : 'Dry run'} • ${formatShortDateTime(instruction.updatedAt)}`)}</time>
                          <p>${escapeHtml(`${instruction.actions.length} grupo(s) • ${failedActions.length} falha(s) • ${pendingActions.length} em curso`)}</p>
                          <ul>
                            ${instruction.actions
                              .map((action) => {
                                const targetGroup = groups.find((group) => group.groupJid === action.targetGroupJid);
                                const label =
                                  targetGroup?.preferredSubject ??
                                  ((action.payload as { readonly targetLabel?: unknown } | undefined)?.targetLabel as string | undefined) ??
                                  action.targetGroupJid ??
                                  'Grupo sem nome';
                                return `<li><strong>${escapeHtml(label)}</strong> - ${escapeHtml(readableInstructionActionStatus(action.status))}${action.lastError ? ` (${escapeHtml(action.lastError)})` : ''}</li>`;
                              })
                              .join('')}
                          </ul>
                          ${
                            this.state.advancedDetailsEnabled
                              ? `
                                <details class="ui-details">
                                  <summary>Detalhes avancados</summary>
                                  <div class="ui-details__content">
                                    <p>Instruction ID: ${escapeHtml(instruction.instructionId)}</p>
                                    <p>Asset ID: ${escapeHtml(payload?.assetId ?? 'desconhecido')}</p>
                                    <p>Source message: ${escapeHtml(instruction.sourceMessageId ?? 'manual')}</p>
                                  </div>
                                </details>
                              `
                              : ''
                          }
                        </article>
                      `;
                    })
                    .join('')}
                </div>
              `
              : `
                <div class="timeline-item">
                  <strong>Sem distribuicoes de media ainda</strong>
                  <time>Assim que criares um dry run ou um envio confirmado, esta vista passa a mostrar o estado por grupo.</time>
                </div>
              `
          }
        </article>
      </section>
    `;
  }

  private renderWorkspacePage(page: UiPage<WorkspaceAgentPageData>): string {
    const draft = this.state.workspaceAgentDraft;
    const status = page.data.status;
    const visibleFiles =
      draft.query.trim().length > 0 || draft.searchResults.length > 0 ? draft.searchResults : page.data.files;
    const selectedFiles = draft.selectedFilePaths;
    const recentRuns = page.data.recentRuns;
    const latestRun = recentRuns[0] ?? null;
    const reviewTargetPath = draft.previewContent?.relativePath ?? selectedFiles[0] ?? null;
    const contextSummary = buildWorkspaceDraftContextSummary(draft);
    const applyBusy = status.busy && draft.mode === 'apply';
    const runButtonDisabled = draft.running || applyBusy;
    const latestRunLabel = latestRun ? readableWorkspaceRunResult(latestRun) : 'Sem runs';
    const latestRunTone = latestRun ? toneForWorkspaceRun(latestRun) : 'neutral';
    const latestRunSummary = latestRun
      ? latestRun.executionState === 'rejected'
        ? latestRun.guardrailReason ?? latestRun.outputSummary
        : `${latestRun.structuredSummary.summary} ${
            latestRun.changedFiles.length > 0
              ? `Mudou ${latestRun.changedFiles.length} ficheiro(s).`
              : latestRun.structuredSummary.readFiles.length > 0
                ? `Leu ${latestRun.structuredSummary.readFiles.length} ficheiro(s).`
                : 'Sem alteracoes guardadas.'
          }`
      : 'Ainda nao ha runs deste agente neste ambiente.';

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Agente do projeto</p>
          <h2>Pedir a uma LLM para rever o repo, escolher foco e alterar codigo do LumeHub com mais contexto.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({
              label:
                draft.mode === 'plan'
                  ? 'Gerar plano'
                  : applyBusy
                    ? 'Apply bloqueado'
                    : 'Executar alteracoes',
              disabled: runButtonDisabled,
              dataAttributes: { 'workspace-action': 'run-agent' },
            })}
            ${renderUiActionButton({
              label: 'Limpar selecao',
              variant: 'secondary',
              dataAttributes: { 'workspace-action': 'clear-selection' },
            })}
            ${
              reviewTargetPath
                ? renderUiActionButton({
                    label: 'Rever ficheiro aberto',
                    variant: 'secondary',
                    dataAttributes: {
                      'workspace-action': 'review-file',
                      'workspace-file-path': reviewTargetPath,
                    },
                  })
                : ''
            }
          </div>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Modo atual',
            badgeLabel: draft.mode === 'plan' ? 'Planear' : 'Aplicar com aprovacao',
            badgeTone: draft.mode === 'plan' ? 'neutral' : 'warning',
            contentHtml: `<p>${escapeHtml(
              draft.mode === 'plan'
                ? 'A LLM analisa o repo e responde com plano, sem editar ficheiros.'
                : `A LLM pode editar ficheiros do repo, mas so depois da tua confirmacao. O backend aceita no maximo ${status.maxFocusedFiles} ficheiro(s) em foco por run.`,
            )}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Fila e guardrails',
            badgeLabel: status.busy ? 'Apply em curso' : 'Livre',
            badgeTone: status.busy ? 'warning' : 'positive',
            contentHtml: `<p>${escapeHtml(
              status.busy
                ? `Ja existe uma run a alterar ficheiros. O backend bloqueia novos apply ate esta terminar.`
                : status.lastRejectedReason
                  ? `Ultima rejeicao: ${status.lastRejectedReason}`
                  : 'Nao ha outra run destrutiva em curso neste momento.',
            )}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Contexto antes de correr',
            badgeLabel: contextSummary.badgeLabel,
            badgeTone: contextSummary.badgeTone,
            contentHtml: `
              <p>${escapeHtml(contextSummary.summary)}</p>
              <div class="ui-card__chips">
                ${contextSummary.chips
                  .map((chip) =>
                    renderUiBadge({
                      label: chip,
                      tone: 'neutral',
                      style: 'chip',
                    }),
                  )
                  .join('')}
              </div>
            `,
          })}
          ${renderUiPanelCard({
            title: 'Ultima run',
            badgeLabel: latestRunLabel,
            badgeTone: latestRunTone,
            contentHtml: `<p>${escapeHtml(latestRunSummary)}</p>`,
          })}
        </div>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-5">
          <div class="card-header">
            <div>
              <h3>Pedir trabalho ao agente</h3>
              <p>Escreve em linguagem natural. Podes orientar com ficheiros concretos ou pedir so revisao sem edicao.</p>
            </div>
            ${renderUiBadge({
              label: draft.running ? 'A correr' : applyBusy ? 'Bloqueado por outra run' : draft.mode === 'plan' ? 'Sem edicao' : 'Com edicao',
              tone: draft.running || applyBusy ? 'warning' : draft.mode === 'plan' ? 'neutral' : 'positive',
            })}
          </div>
          <div class="ui-form-grid">
            ${renderUiSelectField({
              label: 'Modo do agente',
              value: draft.mode,
              dataKey: 'workspace.mode',
              options: [
                { value: 'plan', label: 'So planear' },
                { value: 'apply', label: 'Aplicar alteracoes' },
              ],
              hint: 'Usa planear quando quiseres primeiro ver a abordagem. Usa aplicar quando quiseres mesmo mudar ficheiros.',
            })}
            ${renderUiTextAreaField({
              label: 'Pedido para a LLM',
              value: draft.prompt,
              dataKey: 'workspace.prompt',
              rows: 12,
              placeholder: 'Ex.: Refatora a pagina WhatsApp para ficar mais curta e clara. Atualiza a copy, os componentes e o CSS relevante.',
              hint: 'O agente trabalha apenas dentro do repo do LumeHub e nao faz commit nem push.',
            })}
          </div>
          <div class="workspace-context-grid">
            ${renderUiPanelCard({
              title: 'Antes de aplicar',
              badgeLabel: draft.mode === 'apply' ? 'Com alteracoes' : 'So leitura',
              badgeTone: draft.mode === 'apply' ? 'warning' : 'neutral',
              contentHtml: `<p>${escapeHtml(
                draft.mode === 'apply'
                  ? selectedFiles.length > 0
                    ? `A LLM vai trabalhar com ${selectedFiles.length} ficheiro(s) em foco e ainda pode abrir outros se precisar. Antes de editar, a interface pede confirmacao explicita.`
                    : 'Nao ha ficheiros em foco. O backend vai travar o apply ate escolheres pelo menos um ficheiro.'
                  : reviewTargetPath
                    ? `Este modo e seguro para rever ${reviewTargetPath} sem editar nada.`
                    : 'Este modo serve para perceber a abordagem antes de permitires alteracoes reais.'
              )}</p>`,
            })}
            ${renderUiPanelCard({
              title: 'Resultado recente',
              badgeLabel: latestRun?.fileDiffs.length ? 'Com diff' : 'Sem diff ainda',
              badgeTone: latestRun?.fileDiffs.length ? 'positive' : 'neutral',
              contentHtml: `<p>${escapeHtml(
                latestRun?.fileDiffs.length
                  ? `A ultima run ja mostra diff por ficheiro e resumo de contexto lido.`
                  : 'Assim que houver uma run com alteracoes, os diffs aparecem por ficheiro aqui na pagina.'
              )}</p>`,
            })}
          </div>
          ${
            status.lastRejectedReason
              ? `
                <div class="guide-preview">
                  <p><strong>Ultimo guardrail ativado</strong>: ${escapeHtml(status.lastRejectedReason)}</p>
                  <p>Se aparecer outra vez, ajusta o pedido, reduz o foco ou confirma o apply quando estiveres pronto.</p>
                </div>
              `
              : ''
          }
          ${
            selectedFiles.length > 0
              ? `
                <div class="guide-preview">
                  <p><strong>Ficheiros sugeridos</strong>: ${escapeHtml(String(selectedFiles.length))}</p>
                  <div class="ui-card__chips">
                    ${selectedFiles
                      .map((filePath) =>
                        renderUiBadge({
                          label: filePath,
                          tone: 'positive',
                          style: 'chip',
                        }),
                      )
                      .join('')}
                  </div>
                </div>
              `
              : `
                <div class="timeline-item">
                  <strong>Sem ficheiros pre-selecionados</strong>
                  <time>O agente pode decidir sozinho o que abrir. A selecao aqui serve apenas para orientar mais depressa.</time>
                </div>
              `
          }
        </article>

        <article class="surface content-card span-7">
          <div class="card-header">
            <div>
              <h3>Explorar ficheiros do repo</h3>
              <p>Pesquisa e abre preview antes de pedires a alteracao.</p>
            </div>
            ${renderUiBadge({
              label: `${visibleFiles.length} resultado${visibleFiles.length === 1 ? '' : 's'}`,
              tone: visibleFiles.length > 0 ? 'positive' : 'warning',
            })}
          </div>
          <div class="ui-form-grid ui-form-grid--double">
            ${renderUiInputField({
              label: 'Pesquisar ficheiros',
              value: draft.query,
              dataKey: 'workspace.query',
              placeholder: 'Ex.: AppShell, workspace-agent, README',
              hint: 'Procura por nome ou caminho relativo dentro do LumeHub.',
            })}
            <div class="workspace-search-actions">
              ${renderUiActionButton({
                label: draft.searching ? 'A procurar...' : 'Atualizar lista',
                variant: 'secondary',
                dataAttributes: { 'workspace-action': 'search-files' },
              })}
            </div>
          </div>
          ${
            visibleFiles.length > 0
              ? `
                <div class="timeline workspace-file-list">
                  ${visibleFiles
                    .map(
                      (file) => `
                        <article class="timeline-item workspace-file-item ${draft.previewPath === file.relativePath ? 'workspace-file-item--active' : ''}">
                          <strong>${escapeHtml(file.relativePath)}</strong>
                          <time>${escapeHtml(file.extension || 'sem extensao')}</time>
                  <div class="action-row">
                    ${renderUiActionButton({
                      label: draft.previewPath === file.relativePath ? 'Preview aberto' : 'Abrir preview',
                      variant: draft.previewPath === file.relativePath ? 'primary' : 'secondary',
                      dataAttributes: {
                                'workspace-action': 'preview-file',
                                'workspace-file-path': file.relativePath,
                              },
                            })}
                    ${renderUiActionButton({
                      label: selectedFiles.includes(file.relativePath) ? 'Retirar' : 'Usar no pedido',
                      variant: selectedFiles.includes(file.relativePath) ? 'secondary' : 'primary',
                      dataAttributes: {
                        'workspace-action': 'toggle-file-selection',
                        'workspace-file-path': file.relativePath,
                      },
                    })}
                    ${renderUiActionButton({
                      label: 'Rever sem alterar',
                      variant: 'secondary',
                      dataAttributes: {
                        'workspace-action': 'review-file',
                        'workspace-file-path': file.relativePath,
                      },
                    })}
                  </div>
                </article>
              `,
            )
            .join('')}
                </div>
              `
              : `
                <div class="timeline-item">
                  <strong>Sem resultados para esta pesquisa</strong>
                  <time>Experimenta outra palavra ou limpa a pesquisa para voltar aos ficheiros iniciais.</time>
                </div>
              `
          }
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-7">
          <div class="card-header">
            <div>
              <h3>Preview do ficheiro</h3>
              <p>Leitura local do ficheiro selecionado antes da run, ou para rever o que acabou de ser alterado.</p>
            </div>
            ${renderUiBadge({
              label: draft.previewContent ? draft.previewContent.relativePath : 'Sem preview',
              tone: draft.previewContent ? 'positive' : 'neutral',
            })}
          </div>
          ${
            draft.loadingPreview
              ? `
                <div class="timeline-item">
                  <strong>A carregar preview...</strong>
                  <time>Estamos a ler o ficheiro escolhido dentro do repo.</time>
                </div>
              `
              : draft.previewContent
                ? `
                  <div class="guide-preview">
                    <p><strong>Ficheiro</strong>: ${escapeHtml(draft.previewContent.relativePath)}</p>
                    <p><strong>Tamanho</strong>: ${escapeHtml(formatFileSize(draft.previewContent.sizeBytes))}${draft.previewContent.truncated ? ' • preview truncado' : ''}</p>
                    <div class="action-row">
                      ${renderUiActionButton({
                        label: 'Rever este ficheiro sem alterar',
                        variant: 'secondary',
                        dataAttributes: {
                          'workspace-action': 'review-file',
                          'workspace-file-path': draft.previewContent.relativePath,
                        },
                      })}
                      ${renderUiActionButton({
                        label: selectedFiles.includes(draft.previewContent.relativePath) ? 'Ja esta no pedido' : 'Usar este ficheiro no pedido',
                        variant: selectedFiles.includes(draft.previewContent.relativePath) ? 'secondary' : 'primary',
                        dataAttributes: {
                          'workspace-action': 'toggle-file-selection',
                          'workspace-file-path': draft.previewContent.relativePath,
                        },
                      })}
                    </div>
                  </div>
                  <pre class="workspace-code-preview">${escapeHtml(draft.previewContent.content)}</pre>
                `
                : `
                  <div class="timeline-item">
                    <strong>Nenhum ficheiro aberto</strong>
                    <time>Usa "Abrir preview" na lista ao lado para ver o conteudo antes de pedir alteracoes.</time>
                  </div>
                `
          }
        </article>

        <article class="surface content-card span-5">
          <div class="card-header">
            <div>
              <h3>Runs recentes</h3>
              <p>Historico curto do que a LLM fez neste workspace.</p>
            </div>
            ${renderUiBadge({
              label: `${recentRuns.length} run${recentRuns.length === 1 ? '' : 's'}`,
              tone: recentRuns.length > 0 ? 'positive' : 'neutral',
            })}
          </div>
          ${
            recentRuns.length > 0
              ? `
                <div class="timeline">
                  ${recentRuns
                    .map(
                      (run) => `
                        <article class="timeline-item">
                          <strong>${escapeHtml(run.structuredSummary.summary)}</strong>
                          <time>${escapeHtml(`${run.mode === 'plan' ? 'Plano' : 'Alteracao'} • ${formatShortDateTime(run.completedAt)}`)}</time>
                          <p>${escapeHtml(run.prompt)}</p>
                          <div class="workspace-run-summary-grid">
                            <div class="guide-preview">
                              <p><strong>Resultado</strong>: ${escapeHtml(readableWorkspaceRunResult(run))}</p>
                              <p><strong>Modo</strong>: ${escapeHtml(run.mode === 'plan' ? 'So leitura' : 'Com alteracoes')}</p>
                              <p><strong>Aprovacao</strong>: ${escapeHtml(readableWorkspaceApprovalState(run.approvalState))}</p>
                            </div>
                            <div class="guide-preview">
                              <p><strong>Pedido feito por</strong>: ${escapeHtml(run.requestedBy)}</p>
                              <p><strong>Execucao</strong>: ${escapeHtml(run.executionState === 'rejected' ? 'Travada antes de correr' : 'Agente executado')}</p>
                              ${
                                run.guardrailReason
                                  ? `<p><strong>Guardrail</strong>: ${escapeHtml(run.guardrailReason)}</p>`
                                  : ''
                              }
                            </div>
                            <div class="guide-preview">
                              <p><strong>Ficheiros sugeridos</strong>: ${escapeHtml(String(run.structuredSummary.suggestedFiles.length))}</p>
                              <div class="ui-card__chips">${renderWorkspaceFileBadges(run.structuredSummary.suggestedFiles, 'neutral')}</div>
                            </div>
                            <div class="guide-preview">
                              <p><strong>Ficheiros lidos</strong>: ${escapeHtml(String(run.structuredSummary.readFiles.length))}</p>
                              <div class="ui-card__chips">${renderWorkspaceFileBadges(run.structuredSummary.readFiles, 'positive')}</div>
                            </div>
                            <div class="guide-preview">
                              <p><strong>Ficheiros mudados</strong>: ${escapeHtml(String(run.changedFiles.length))}</p>
                              <div class="ui-card__chips">${renderWorkspaceFileBadges(run.changedFiles, run.changedFiles.length > 0 ? 'warning' : 'neutral')}</div>
                            </div>
                          </div>
                          ${
                            run.structuredSummary.notes.length > 0
                              ? `
                                <div class="guide-preview">
                                  <p><strong>Notas da run</strong></p>
                                  <ul>
                                    ${run.structuredSummary.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
                                  </ul>
                                </div>
                              `
                              : ''
                          }
                          ${
                            run.fileDiffs.length > 0
                              ? `
                                <details class="ui-details">
                                  <summary>Ver diff por ficheiro</summary>
                                  <div class="ui-details__content workspace-diff-stack">
                                    ${run.fileDiffs
                                      .map(
                                        (fileDiff) => `
                                          <details class="ui-details workspace-diff-item">
                                            <summary>${escapeHtml(fileDiff.relativePath)} • ${escapeHtml(readableWorkspaceChangeType(fileDiff.changeType))}</summary>
                                            <div class="ui-details__content">
                                              <p><strong>Estado antes</strong>: ${escapeHtml(fileDiff.beforeStatus ?? 'limpo ou sem tracking')}</p>
                                              <p><strong>Estado depois</strong>: ${escapeHtml(fileDiff.afterStatus ?? 'removido')}</p>
                                              <pre class="workspace-run-diff">${escapeHtml(fileDiff.diffText)}</pre>
                                            </div>
                                          </details>
                                        `,
                                      )
                                      .join('')}
                                  </div>
                                </details>
                              `
                              : ''
                          }
                          <details class="ui-details">
                            <summary>Ver saida desta run</summary>
                            <div class="ui-details__content">
                              <p><strong>Exit code</strong>: ${escapeHtml(String(run.exitCode ?? 'n/a'))}${run.timedOut ? ' • timeout' : ''}</p>
                              ${run.filePaths.length > 0 ? `<p><strong>Ficheiros sugeridos no pedido</strong>: ${escapeHtml(run.filePaths.join(', '))}</p>` : ''}
                              <pre class="workspace-run-output">${escapeHtml(run.stdout || run.stderr || 'Sem output textual guardado.')}</pre>
                            </div>
                          </details>
                        </article>
                      `,
                    )
                    .join('')}
                </div>
              `
              : `
                <div class="timeline-item">
                  <strong>Sem runs ainda</strong>
                  <time>Assim que pedires uma analise ou alteracao, ela aparece aqui com os ficheiros mudados.</time>
                </div>
              `
          }
        </article>
      </section>
    `;
  }

  private renderGroupsPage(page: UiPage<GroupManagementPageData>): string {
    const { groups, people, intelligence, contextPreview } = page.data;
    const selectedGroup =
      groups.find((group) => group.groupJid === this.state.groupManagementDraft.selectedGroupJid) ?? null;
    const selectedDocument =
      intelligence?.knowledge.documents.find(
        (document) => document.documentId === this.state.groupManagementDraft.selectedDocumentId,
      ) ?? null;
    const documentCount = intelligence?.knowledge.documents.length ?? 0;
    const previewSnippetCount = contextPreview?.groupKnowledgeSnippets.length ?? 0;
    const instructionsState = intelligence?.instructions.exists ? 'Canonico' : 'Em falta';
    const instructionsTone =
      intelligence?.instructions.source === 'llm_instructions'
        ? 'positive'
        : intelligence?.instructions.exists
          ? 'warning'
          : 'danger';
    const authorizedGroupJids = resolveAuthorizedGroupJidsForCommands(groups, page.data.commandSettings);
    const activeGroups = authorizedGroupJids.length;
    const assistantAuthorized = selectedGroup ? authorizedGroupJids.includes(selectedGroup.groupJid) : false;
    const ownerSummary = selectedGroup ? describeGroupOwners(selectedGroup, people) : 'Sem responsavel definido.';
    const primaryOwnerPersonId = selectedGroup?.groupOwners[0]?.personId ?? '';
    const primaryOwnerLabel =
      primaryOwnerPersonId.length > 0 ? resolvePersonDisplayName(primaryOwnerPersonId, people) : 'Sem responsavel definido';
    const groupModeLabel = selectedGroup ? readableGroupMode(selectedGroup.operationalSettings.mode) : 'Escolher grupo';
    const groupModeTone = selectedGroup ? toneForGroupMode(selectedGroup.operationalSettings.mode) : 'warning';
    const memberTagLabel = selectedGroup
      ? readableGroupMemberTagPolicy(selectedGroup.operationalSettings.memberTagPolicy)
      : 'Sem grupo';
    const schedulingLabel =
      selectedGroup && selectedGroup.operationalSettings.schedulingEnabled ? 'Agendamento ativo' : 'Agendamento desligado';
    const llmSchedulingLabel =
      selectedGroup && selectedGroup.operationalSettings.allowLlmScheduling ? 'LLM pode agendar' : 'LLM sem scheduling';
    const ownerOptions = selectedGroup ? buildGroupOwnerOptions(selectedGroup, people) : [{ value: '', label: 'Sem pessoas conhecidas' }];
    const ownerOverflowCount = Math.max((selectedGroup?.groupOwners.length ?? 0) - (primaryOwnerPersonId ? 1 : 0), 0);

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Pagina do grupo</p>
          <h2>Gerir owner, modo e politicas locais sem perder o contexto isolado de cada grupo.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({
              label: 'Atualizar preview',
              dataAttributes: { 'group-action': 'refresh-preview' },
            })}
            ${renderUiActionButton({
              label: 'Ver WhatsApp',
              href: '/whatsapp',
              variant: 'secondary',
              dataAttributes: { route: '/whatsapp' },
            })}
          </div>
          ${
            groups.length > 0
              ? `
                <label class="ui-field group-page-switcher">
                  <span class="ui-field__label">Trocar grupo nesta pagina</span>
                  <select class="ui-control" data-group-page-switcher>
                    ${groups
                      .map(
                        (group) =>
                          `<option value="${escapeHtml(group.groupJid)}"${group.groupJid === selectedGroup?.groupJid ? ' selected' : ''}>${escapeHtml(group.preferredSubject)}</option>`,
                      )
                      .join('')}
                  </select>
                  <span class="ui-field__hint">Ao trocares aqui, abres logo o workspace operacional desse grupo.</span>
                </label>
              `
              : ''
          }
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Grupo em foco',
            badgeLabel: selectedGroup ? groupModeLabel : 'Escolher grupo',
            badgeTone: groupModeTone,
            contentHtml: `<p>${escapeHtml(
              selectedGroup
                ? `Estas a gerir ${selectedGroup.preferredSubject}. O owner atual e ${primaryOwnerLabel} e o contexto continua isolado neste grupo.`
                : 'Escolhe um grupo para veres owner, politicas locais, instrucoes e documentos.',
            )}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Comportamento esperado',
            badgeLabel: memberTagLabel,
            badgeTone: selectedGroup?.operationalSettings.memberTagPolicy === 'members_can_tag' ? 'positive' : 'warning',
            contentHtml: `<p>${escapeHtml(
              selectedGroup
                ? describeGroupMode(selectedGroup.operationalSettings.mode, selectedGroup.operationalSettings.allowLlmScheduling)
                : 'Escolhe um grupo para a pagina te explicar o que o bot pode fazer aqui.',
            )}</p>`,
          })}
        </div>
      </section>

      ${
        page.data.loadWarning
          ? `
            <section class="surface flow-feedback flow-feedback--warning" role="status" aria-live="polite">
              <p>${escapeHtml(page.data.loadWarning)}</p>
            </section>
          `
          : ''
      }

      <section class="content-grid">
        <article class="surface content-card span-4">
          <div class="card-header card-header--with-switch">
            <div>
              <h3>Mapa de grupos</h3>
              <p>Troca rapidamente entre grupos e confirma onde o assistente esta ligado.</p>
            </div>
            <div class="card-header__actions card-header__actions--group-master">
              ${renderUiBadge({ label: `${groups.length} grupos`, tone: 'neutral' })}
              ${renderUiSwitch({
                label: 'Assistente nos grupos',
                checked: page.data.commandSettings.assistantEnabled,
                description: page.data.commandSettings.assistantEnabled
                  ? `${activeGroups} grupo(s) ligados agora.`
                  : 'Desligado em todos os grupos.',
                dataAttributes: {
                  'group-action': 'toggle-assistant-master',
                },
              })}
            </div>
          </div>
          <div class="timeline">
            ${groups
              .map((group) => {
                const isSelected = group.groupJid === selectedGroup?.groupJid;
                const owners = describeGroupOwners(group, people);
                const groupAuthorized = authorizedGroupJids.includes(group.groupJid);

                return `
                  <article class="timeline-item group-tile ${isSelected ? 'group-tile--selected' : ''}">
                    <button
                      type="button"
                      class="group-tile__select"
                      data-group-action="select-group"
                      data-group-jid="${escapeHtml(group.groupJid)}"
                    >
                      <strong>${escapeHtml(group.preferredSubject)}</strong>
                      <time>${escapeHtml(group.courseId ?? 'Sem curso associado')}</time>
                      <p>${escapeHtml(`${owners} • ${readableGroupMode(group.operationalSettings.mode)}`)}</p>
                    </button>
                    <div class="group-tile__switch">
                      ${renderUiSwitch({
                        label: 'Assistente neste grupo',
                        checked: groupAuthorized,
                        description: groupAuthorized ? 'Ligado neste grupo.' : 'Bloqueado neste grupo.',
                        dataAttributes: {
                          'group-action': 'toggle-group-authorized',
                          'group-jid': group.groupJid,
                        },
                      })}
                    </div>
                  </article>
                `;
              })
              .join('')}
          </div>
        </article>

        <article class="surface content-card span-8">
          <div class="card-header">
            <div>
              <h3>Configuracao operacional</h3>
              <p>Esta pagina deve responder primeiro a owner, modo do grupo, tags ao bot e switches locais.</p>
            </div>
            ${renderUiBadge({ label: selectedGroup ? selectedGroup.preferredSubject : 'Escolher grupo', tone: selectedGroup ? 'positive' : 'warning' })}
          </div>
          ${
            selectedGroup
              ? `
                <div class="card-grid group-page-overview-grid">
                  ${renderUiRecordCard({
                    title: 'Resumo operacional',
                    subtitle: ownerSummary,
                    badgeLabel: assistantAuthorized ? 'Assistente ligado' : 'Assistente bloqueado',
                    badgeTone: assistantAuthorized ? 'positive' : 'warning',
                    chips: [
                      { label: groupModeLabel, tone: groupModeTone },
                      {
                        label: schedulingLabel,
                        tone: selectedGroup.operationalSettings.schedulingEnabled ? 'positive' : 'warning',
                      },
                      {
                        label: llmSchedulingLabel,
                        tone: selectedGroup.operationalSettings.allowLlmScheduling ? 'positive' : 'warning',
                      },
                    ],
                    bodyHtml: `
                      <p><strong>Tags ao bot</strong>: ${escapeHtml(memberTagLabel)}.</p>
                      <p><strong>Calendario</strong>: ${escapeHtml(
                        `Membros ${readableCalendarAccessMode(selectedGroup.calendarAccessPolicy.group)}, Responsavel ${readableCalendarAccessMode(selectedGroup.calendarAccessPolicy.groupOwner)}, Admin ${readableCalendarAccessMode(selectedGroup.calendarAccessPolicy.appOwner)}.`,
                      )}</p>
                    `,
                    detailsSummary: this.state.advancedDetailsEnabled ? 'Detalhes tecnicos deste grupo' : undefined,
                    detailsHtml: this.state.advancedDetailsEnabled
                      ? `
                          <p>JID: ${escapeHtml(selectedGroup.groupJid)}</p>
                          <p>Alias: ${escapeHtml(selectedGroup.aliases.join(', ') || 'sem alias')}</p>
                          <p>Instrucoes canonicas: ${escapeHtml(intelligence?.instructions.primaryFilePath ?? 'ainda sem ficheiro carregado')}</p>
                        `
                      : undefined,
                  })}
                  ${renderUiRecordCard({
                    title: 'Como este grupo opera',
                    subtitle:
                      selectedGroup.operationalSettings.mode === 'com_agendamento'
                        ? 'Pedidos deste grupo podem entrar no fluxo assistido de scheduling.'
                        : 'Mensagens entram em distribuicao/fan-out e nao em agendamento local por defeito.',
                    badgeLabel: memberTagLabel,
                    badgeTone:
                      selectedGroup.operationalSettings.memberTagPolicy === 'members_can_tag' ? 'positive' : 'warning',
                    bodyHtml: `
                      <p>${escapeHtml(
                        describeGroupMode(
                          selectedGroup.operationalSettings.mode,
                          selectedGroup.operationalSettings.allowLlmScheduling,
                        ),
                      )}</p>
                      <p>${escapeHtml(
                        selectedGroup.operationalSettings.memberTagPolicy === 'members_can_tag'
                          ? 'Qualquer membro pode dirigir o bot neste grupo quando a policy o permitir.'
                          : 'So o owner do grupo pode dirigir o bot neste grupo por tag.',
                      )}</p>
                    `,
                  })}
                </div>

                <article class="surface ui-card group-configuration-card">
                  <div class="ui-card__header">
                    <div>
                      <p class="ui-card__eyebrow">Configuracao</p>
                      <h3 class="ui-card__title">Owner, modo e politicas locais</h3>
                    </div>
                    ${renderUiBadge({ label: instructionsState, tone: instructionsTone })}
                  </div>
                  <div class="ui-card__content">
                    <div class="ui-form-grid ui-form-grid--double">
                      <label class="ui-field">
                        <span class="ui-field__label">Responsavel do grupo</span>
                        <select
                          class="ui-control"
                          data-group-owner-select
                          data-group-jid="${escapeHtml(selectedGroup.groupJid)}"
                          ${ownerOptions.length <= 1 ? 'disabled' : ''}
                        >
                          ${ownerOptions
                            .map(
                              (option) =>
                                `<option value="${escapeHtml(option.value)}"${option.value === primaryOwnerPersonId ? ' selected' : ''}>${escapeHtml(option.label)}</option>`,
                            )
                            .join('')}
                        </select>
                        <span class="ui-field__hint">${escapeHtml(
                          ownerOverflowCount > 0
                            ? `Existem ${ownerOverflowCount} owner(s) extra no catalogo atual; esta pagina assume um owner operacional principal.`
                            : 'Ao mudar aqui, o grupo fica com esse owner operacional principal.',
                        )}</span>
                      </label>
                      <label class="ui-field">
                        <span class="ui-field__label">Modo do grupo</span>
                        <select
                          class="ui-control"
                          data-group-operational-setting="mode"
                          data-group-jid="${escapeHtml(selectedGroup.groupJid)}"
                        >
                          <option value="com_agendamento"${selectedGroup.operationalSettings.mode === 'com_agendamento' ? ' selected' : ''}>Com agendamento</option>
                          <option value="distribuicao_apenas"${selectedGroup.operationalSettings.mode === 'distribuicao_apenas' ? ' selected' : ''}>Distribuicao apenas</option>
                        </select>
                        <span class="ui-field__hint">Define se este grupo usa scheduling assistido ou apenas distribuicao.</span>
                      </label>
                    </div>
                    <div class="ui-form-grid ui-form-grid--double">
                      <label class="ui-field">
                        <span class="ui-field__label">Quem pode tagar o bot</span>
                        <select
                          class="ui-control"
                          data-group-operational-setting="memberTagPolicy"
                          data-group-jid="${escapeHtml(selectedGroup.groupJid)}"
                        >
                          <option value="members_can_tag"${selectedGroup.operationalSettings.memberTagPolicy === 'members_can_tag' ? ' selected' : ''}>Membros podem tagar</option>
                          <option value="owner_only"${selectedGroup.operationalSettings.memberTagPolicy === 'owner_only' ? ' selected' : ''}>So o owner pode tagar</option>
                        </select>
                        <span class="ui-field__hint">A policy define quem pode dirigir o bot no grupo antes de qualquer ACL mais fina.</span>
                      </label>
                      <div class="group-settings-note">
                        <strong>Switches locais</strong>
                        <p>Estes switches deixam-te separar o modo do grupo da disponibilidade real do assistente e do scheduling.</p>
                      </div>
                    </div>
                    <div class="group-settings-switches">
                      ${renderUiSwitch({
                        label: 'Assistente neste grupo',
                        checked: assistantAuthorized,
                        description: assistantAuthorized ? 'Ligado neste grupo.' : 'Bloqueado neste grupo.',
                        dataAttributes: {
                          'group-action': 'toggle-group-authorized',
                          'group-jid': selectedGroup.groupJid,
                        },
                      })}
                      ${renderUiSwitch({
                        label: 'Agendamento ativo',
                        checked: selectedGroup.operationalSettings.schedulingEnabled,
                        description: selectedGroup.operationalSettings.schedulingEnabled
                          ? 'O grupo pode manter scheduling local ativo.'
                          : 'O scheduling local fica desligado neste grupo.',
                        dataAttributes: {
                          'group-action': 'toggle-scheduling-enabled',
                          'group-jid': selectedGroup.groupJid,
                        },
                      })}
                      ${renderUiSwitch({
                        label: 'LLM pode decidir agendamentos',
                        checked: selectedGroup.operationalSettings.allowLlmScheduling,
                        description: selectedGroup.operationalSettings.allowLlmScheduling
                          ? 'A LLM pode preparar ou decidir scheduling neste grupo.'
                          : 'A LLM fica sem poderes de scheduling neste grupo.',
                        dataAttributes: {
                          'group-action': 'toggle-llm-scheduling',
                          'group-jid': selectedGroup.groupJid,
                        },
                      })}
                    </div>
                  </div>
                </article>
              `
              : '<p>Escolhe um grupo na coluna da esquerda para comecares a gerir owner, politicas locais e contexto LLM.</p>'
          }
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-7">
          <div class="card-header">
            <div>
              <h3>Instrucoes e preview</h3>
              <p>Aqui defines como a LLM deve interpretar este grupo e confirmas logo o contexto que seria usado.</p>
            </div>
            ${renderUiBadge({ label: instructionsState, tone: instructionsTone })}
          </div>
          ${
            selectedGroup
              ? `
                <div class="ui-form-grid">
                  ${renderUiTextAreaField({
                    label: `Instrucoes para ${selectedGroup.preferredSubject}`,
                    value: this.state.groupManagementDraft.instructions,
                    dataKey: 'group.instructions',
                    rows: 10,
                    placeholder: 'Ex.: Neste grupo, Aula 1 refere-se sempre ao bloco tecnico base...',
                    hint: 'Tudo o que escreveres aqui fica guardado no ficheiro canonico do grupo.',
                  })}
                  ${renderUiTextAreaField({
                    label: 'Pergunta para testar o preview',
                    value: this.state.groupManagementDraft.previewText,
                    dataKey: 'group.previewText',
                    rows: 6,
                    placeholder: 'Ex.: A Aula 1 mudou de sala?',
                    hint: 'Serve para confirmar logo o contexto que o assistente montaria para esta mensagem.',
                  })}
                </div>
                <div class="action-row">
                  ${renderUiActionButton({
                    label: 'Guardar instrucoes',
                    dataAttributes: { 'group-action': 'save-instructions' },
                  })}
                  ${renderUiActionButton({
                    label: 'Atualizar preview',
                    variant: 'secondary',
                    dataAttributes: { 'group-action': 'refresh-preview' },
                  })}
                </div>
                ${
                  contextPreview
                    ? `
                      <div class="guide-preview">
                        <p><strong>Mensagem em teste</strong>: ${escapeHtml(contextPreview.currentText || 'Sem texto de teste ainda.')}</p>
                        <p><strong>Fonte ativa</strong>: ${escapeHtml(contextPreview.groupInstructionsSource)}</p>
                        <p><strong>Snippets encontrados</strong>: ${escapeHtml(String(previewSnippetCount))}</p>
                      </div>
                      ${
                        contextPreview.groupKnowledgeSnippets.length > 0
                          ? `
                            <div class="timeline">
                              ${contextPreview.groupKnowledgeSnippets
                                .slice(0, 3)
                                .map(
                                  (snippet) => `
                                    <article class="timeline-item">
                                      <strong>${escapeHtml(snippet.title)}</strong>
                                      <time>${escapeHtml(`${snippet.filePath} • ${snippet.score} match`)}</time>
                                      <p>${escapeHtml(snippet.excerpt)}</p>
                                    </article>
                                  `,
                                )
                                .join('')}
                            </div>
                          `
                          : `
                            <div class="timeline-item">
                              <strong>Sem snippets relevantes</strong>
                              <time>Experimenta outra pergunta ou reforca os documentos deste grupo.</time>
                            </div>
                          `
                      }
                    `
                    : '<p>Ainda nao atualizaste o preview deste grupo.</p>'
                }
                ${
                  this.state.advancedDetailsEnabled && intelligence
                    ? `
                      <details class="ui-details">
                        <summary>Detalhes tecnicos desta fonte</summary>
                        <div class="ui-details__content">
                          <p>Ficheiro canonico: ${escapeHtml(intelligence.instructions.primaryFilePath)}</p>
                          <p>Resolvido a partir de: ${escapeHtml(intelligence.instructions.resolvedFilePath ?? 'nenhum ficheiro')}</p>
                        </div>
                      </details>
                    `
                    : ''
                }
              `
              : '<p>Escolhe um grupo para comecares a editar instrucoes e preview.</p>'
          }
        </article>

        <article class="surface content-card span-5">
          <div class="card-header">
            <div>
              <h3>Documentos deste grupo</h3>
              <p>Normas, excecoes e conhecimento ficam guardados na pasta do proprio grupo.</p>
            </div>
            ${renderUiBadge({
              label: `${documentCount} documento${documentCount === 1 ? '' : 's'}`,
              tone: documentCount > 0 ? 'positive' : 'warning',
            })}
          </div>
          ${
            selectedGroup
              ? `
                <div class="action-row">
                  ${renderUiActionButton({
                    label: 'Novo documento',
                    variant: 'secondary',
                    dataAttributes: { 'group-action': 'new-document' },
                  })}
                </div>
                <div class="timeline">
                  ${
                    intelligence && intelligence.knowledge.documents.length > 0
                      ? intelligence.knowledge.documents
                          .map((document) => {
                            const isSelected = document.documentId === selectedDocument?.documentId;

                            return `
                              <article class="timeline-item ${isSelected ? 'group-document--selected' : ''}">
                                <strong>${escapeHtml(document.title)}</strong>
                                <time>${escapeHtml(document.filePath)}</time>
                                <p>${escapeHtml(document.summary ?? 'Sem resumo ainda.')}</p>
                                <div class="action-row">
                                  ${renderUiActionButton({
                                    label: isSelected ? 'A editar' : 'Editar',
                                    variant: isSelected ? 'primary' : 'secondary',
                                    dataAttributes: {
                                      'group-action': 'load-document',
                                      'group-document-id': document.documentId,
                                    },
                                  })}
                                  ${renderUiActionButton({
                                    label: 'Apagar',
                                    variant: 'secondary',
                                    dataAttributes: {
                                      'group-action': 'delete-document',
                                      'group-document-id': document.documentId,
                                    },
                                  })}
                                </div>
                              </article>
                            `;
                          })
                          .join('')
                      : `
                        <div class="timeline-item">
                          <strong>Sem documentos ainda</strong>
                          <time>Podes guardar aqui o primeiro documento desta knowledge base.</time>
                        </div>
                      `
                  }
                </div>
                <details class="ui-details">
                  <summary>Editar documento selecionado</summary>
                  <div class="ui-details__content">
                    <div class="ui-form-grid">
                      ${renderUiInputField({
                        label: 'Titulo humano',
                        value: this.state.groupManagementDraft.knowledgeDocument.title,
                        dataKey: 'group.title',
                        placeholder: 'Ex.: Aula 1 de Ballet Iniciacao',
                      })}
                      ${renderUiInputField({
                        label: 'Resumo curto',
                        value: this.state.groupManagementDraft.knowledgeDocument.summary,
                        dataKey: 'group.summary',
                        placeholder: 'Resumo curto para identificar este documento.',
                      })}
                    </div>
                    <details class="ui-details">
                      <summary>Metadados do documento</summary>
                      <div class="ui-details__content">
                        <div class="ui-form-grid ui-form-grid--triple">
                          ${renderUiInputField({
                            label: 'Document ID',
                            value: this.state.groupManagementDraft.knowledgeDocument.documentId,
                            dataKey: 'group.documentId',
                            placeholder: 'ex.: aula-1-ballet',
                            hint: 'Identificador estavel para preview e auditoria.',
                          })}
                          ${renderUiInputField({
                            label: 'Ficheiro relativo',
                            value: this.state.groupManagementDraft.knowledgeDocument.filePath,
                            dataKey: 'group.filePath',
                            placeholder: 'ex.: aulas/aula-1.md',
                            hint: 'Caminho relativo dentro de knowledge/.',
                          })}
                          ${renderUiSelectField({
                            label: 'Estado',
                            value: this.state.groupManagementDraft.knowledgeDocument.enabled,
                            dataKey: 'group.enabled',
                            options: [
                              { value: 'enabled', label: 'Ativo' },
                              { value: 'disabled', label: 'Desligado' },
                            ],
                          })}
                        </div>
                        <div class="ui-form-grid">
                          ${renderUiInputField({
                            label: 'Aliases',
                            value: this.state.groupManagementDraft.knowledgeDocument.aliases,
                            dataKey: 'group.aliases',
                            placeholder: 'Ex.: Aula 1, Ballet Basico',
                            hint: 'Separados por virgula.',
                          })}
                          ${renderUiInputField({
                            label: 'Tags',
                            value: this.state.groupManagementDraft.knowledgeDocument.tags,
                            dataKey: 'group.tags',
                            placeholder: 'Ex.: ballet, iniciacao',
                            hint: 'Separadas por virgula.',
                          })}
                        </div>
                      </div>
                    </details>
                    ${renderUiTextAreaField({
                      label: 'Conteudo markdown',
                      value: this.state.groupManagementDraft.knowledgeDocument.content,
                      dataKey: 'group.content',
                      rows: 12,
                      placeholder: '# Aula 1\n\nExplica aqui a norma, o significado e as excecoes deste grupo.',
                      hint: 'Este corpo e o que depois entra no retrieval isolado deste grupo.',
                    })}
                    <div class="action-row">
                      ${renderUiActionButton({
                        label: 'Guardar documento',
                        dataAttributes: { 'group-action': 'save-document' },
                      })}
                      ${renderUiActionButton({
                        label: 'Novo documento',
                        variant: 'secondary',
                        dataAttributes: { 'group-action': 'new-document' },
                      })}
                    </div>
                  </div>
                </details>
              `
              : '<p>Escolhe primeiro um grupo para comecares a gerir documentos de conhecimento.</p>'
          }
        </article>
      </section>
    `;
  }

  private renderWhatsAppPage(page: UiPage<WhatsAppManagementPageData>): string {
    const snapshot = page.data.workspace;
    const people = buildWorkspacePeople(page.data);
    const liveQrVisible = this.state.whatsappQrPreviewVisible && snapshot.runtime.qr.available && snapshot.runtime.qr.svg;
    const nextWhatsAppStep = snapshot.runtime.qr.available
      ? 'Faz o scan do QR e confirma se a sessao passa para ligada.'
      : !snapshot.runtime.session.connected
        ? 'Atualiza a sessao e confirma se o auth ainda esta valido.'
        : snapshot.permissionSummary.authorizedGroups === 0
          ? 'Autoriza os grupos onde o assistente deve poder operar.'
          : 'A ligacao parece pronta; revê apenas grupos e responsaveis.';

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Canal WhatsApp</p>
          <h2>Ver o estado da sessao, quem controla a app e em que grupos o assistente pode atuar.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({
              label: this.state.whatsappQrPreviewVisible ? 'Fechar QR de emparelhamento' : 'Ver QR de emparelhamento',
              dataAttributes: { 'whatsapp-action': 'toggle-qr-preview' },
            })}
            ${renderUiActionButton({
              label: 'Atualizar agora',
              variant: 'secondary',
              dataAttributes: { 'whatsapp-action': 'refresh-workspace' },
            })}
            ${renderUiActionButton({ label: 'Ver grupos', href: '/groups', variant: 'secondary', dataAttributes: { route: '/groups' } })}
          </div>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Sessao atual',
            badgeLabel: readableSessionPhase(snapshot.runtime.session.phase),
            badgeTone: toneForSessionPhase(snapshot.runtime.session.phase),
            contentHtml: `<p>${escapeHtml(
              snapshot.runtime.session.connected
                ? 'A sessao esta aberta e pronta para discovery e envio real.'
                : snapshot.runtime.session.loginRequired
                  ? 'Ainda falta autenticar a sessao. O QR aparece quando o backend o publicar.'
                  : 'A ligacao existe mas ainda nao esta pronta. Vale a pena rever QR e reconnect.',
            )}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Proximo passo',
            badgeLabel: snapshot.runtime.qr.available ? 'QR pronto' : 'Rever ligacao',
            badgeTone: snapshot.runtime.qr.available ? 'positive' : 'warning',
            contentHtml: `<p>${escapeHtml(nextWhatsAppStep)}</p>`,
          })}
        </div>
      </section>

      <section class="card-grid">
        ${renderUiMetricCard({ title: 'Sessao', value: readableSessionPhase(snapshot.runtime.session.phase), tone: toneForSessionPhase(snapshot.runtime.session.phase), description: 'Estado live da ligacao WhatsApp.' })}
        ${renderUiMetricCard({ title: 'Grupos ligados', value: `${snapshot.permissionSummary.authorizedGroups}/${snapshot.permissionSummary.knownGroups}`, tone: snapshot.permissionSummary.authorizedGroups > 0 ? 'positive' : 'warning', description: 'Grupos onde o assistente pode atuar agora.' })}
        ${renderUiMetricCard({ title: 'App owners', value: String(snapshot.permissionSummary.appOwners), tone: 'positive', description: 'Pessoas com controlo global da aplicacao.' })}
      </section>

      <section class="content-grid">
        <article class="surface content-card span-5">
          <div class="card-header">
            <h3>Sessao e emparelhamento</h3>
            ${renderUiBadge({ label: readableSessionPhase(snapshot.runtime.session.phase), tone: toneForSessionPhase(snapshot.runtime.session.phase) })}
          </div>
          <div class="ui-card__content">
            ${liveQrVisible ? `
              <div class="qr-preview">
                <div class="qr-preview__code qr-preview__code--svg" aria-label="QR de emparelhamento live do WhatsApp">${snapshot.runtime.qr.svg ?? ''}</div>
                <div class="qr-preview__body">
                  <strong>QR live pronto para scan</strong>
                  <p>Aponta o telemovel da conta operadora a este QR para autenticar a sessao real do LumeHub.</p>
                  <p>Gerado: ${escapeHtml(formatShortDateTime(snapshot.runtime.qr.updatedAt))}</p>
                  <div class="action-row qr-preview__actions">
                    <a class="ui-button ui-button--secondary" href="/api/qr.svg" target="_blank" rel="noreferrer noopener">Abrir QR isolado</a>
                  </div>
                </div>
              </div>
            ` : `
              <div class="guide-preview">
                <p><strong>Estado atual</strong>: ${escapeHtml(snapshot.runtime.session.lastError ?? 'sem erro live conhecido')}</p>
                <p><strong>Depois do scan</strong>: confirmar sessao ligada, grupos descobertos e permissoes base.</p>
              </div>
            `}
            <details class="ui-details">
              <summary>Mais controlos do canal</summary>
              <div class="ui-details__content">
                <div class="action-row">
                  ${renderUiActionButton({
                    label: snapshot.settings.whatsapp.enabled ? 'Desligar canal' : 'Ligar canal',
                    variant: snapshot.settings.whatsapp.enabled ? 'secondary' : 'primary',
                    dataAttributes: { 'whatsapp-action': 'toggle-whatsapp-enabled' },
                  })}
                  ${renderUiActionButton({
                    label: snapshot.settings.commands.allowPrivateAssistant ? 'Bloquear privados' : 'Permitir privados',
                    variant: 'secondary',
                    dataAttributes: { 'whatsapp-action': 'toggle-private-assistant-global' },
                  })}
                </div>
                <div class="ui-card__chips">
                  ${renderUiBadge({ label: snapshot.runtime.session.sessionPresent ? 'Sessao presente' : 'Sessao em falta', tone: snapshot.runtime.session.sessionPresent ? 'positive' : 'warning', style: 'chip' })}
                  ${renderUiBadge({ label: snapshot.runtime.qr.available ? 'QR publicado' : 'Sem QR ativo', tone: snapshot.runtime.qr.available ? 'positive' : 'neutral', style: 'chip' })}
                  ${renderUiBadge({ label: snapshot.settings.whatsapp.sharedAuthWithCodex ? 'Mesmo auth do Codex' : 'Auth isolado', tone: snapshot.settings.whatsapp.sharedAuthWithCodex ? 'positive' : 'warning', style: 'chip' })}
                  ${renderUiBadge({ label: snapshot.settings.whatsapp.groupDiscoveryEnabled ? 'Descoberta grupos ativa' : 'Descoberta grupos desligada', tone: snapshot.settings.whatsapp.groupDiscoveryEnabled ? 'positive' : 'warning', style: 'chip' })}
                  ${renderUiBadge({ label: snapshot.settings.whatsapp.conversationDiscoveryEnabled ? 'Descoberta conversas ativa' : 'Descoberta conversas desligada', tone: snapshot.settings.whatsapp.conversationDiscoveryEnabled ? 'positive' : 'warning', style: 'chip' })}
                </div>
                <div class="action-row">
                  ${renderUiActionButton({
                    label: snapshot.settings.whatsapp.sharedAuthWithCodex ? 'Usar auth isolado' : 'Partilhar auth do Codex',
                    variant: 'secondary',
                    dataAttributes: { 'whatsapp-action': 'toggle-shared-auth' },
                  })}
                  ${renderUiActionButton({
                    label: snapshot.settings.whatsapp.groupDiscoveryEnabled ? 'Pausar descoberta de grupos' : 'Ativar descoberta de grupos',
                    variant: 'secondary',
                    dataAttributes: { 'whatsapp-action': 'toggle-group-discovery' },
                  })}
                  ${renderUiActionButton({
                    label: snapshot.settings.whatsapp.conversationDiscoveryEnabled ? 'Pausar descoberta de conversas' : 'Ativar descoberta de conversas',
                    variant: 'secondary',
                    dataAttributes: { 'whatsapp-action': 'toggle-conversation-discovery' },
                  })}
                </div>
              </div>
            </details>
          </div>
        </article>

        <article class="surface content-card span-7">
          <div class="card-header">
            <div>
              <h3>Pessoas com controlo</h3>
              <p>Daqui decides quem pode gerir a app e quem pode falar com o assistente em privado.</p>
            </div>
            ${renderUiBadge({ label: `${people.filter((person) => person.personId).length} pessoas`, tone: 'neutral' })}
          </div>
          <div class="timeline">
            ${people.length > 0
              ? people
                  .map(
                    (person) => `
                      <article class="timeline-item">
                        <strong>${escapeHtml(person.displayName)}</strong>
                        <time>${escapeHtml(person.globalRoles.includes('app_owner') ? 'App owner' : 'Membro')}</time>
                        <p>${escapeHtml(
                          person.whatsappJids.length > 0
                            ? `${person.whatsappJids.length} contacto(s) WhatsApp conhecido(s) • ${person.privateAssistantAuthorized ? 'privado permitido' : 'privado bloqueado'}`
                            : 'Sem contacto WhatsApp conhecido',
                        )}</p>
                        ${
                          person.personId
                            ? `
                                <details class="ui-details">
                                  <summary>Gerir esta pessoa</summary>
                                  <div class="ui-details__content">
                                    <div class="action-row">
                                      ${renderUiActionButton({
                                        label: person.globalRoles.includes('app_owner') ? 'Remover app owner' : 'Tornar app owner',
                                        variant: person.globalRoles.includes('app_owner') ? 'secondary' : 'primary',
                                        dataAttributes: {
                                          'whatsapp-action': 'toggle-app-owner',
                                          'person-id': person.personId,
                                        },
                                      })}
                                      ${
                                        person.whatsappJids.length > 0
                                          ? renderUiActionButton({
                                              label: person.privateAssistantAuthorized ? 'Bloquear privado' : 'Permitir privado',
                                              variant: 'secondary',
                                              dataAttributes: {
                                                'whatsapp-action': 'toggle-private-person',
                                                'person-id': person.personId,
                                              },
                                            })
                                          : ''
                                      }
                                    </div>
                                    <p>${escapeHtml(
                                      person.ownedGroupJids.length > 0
                                        ? `${person.ownedGroupJids.length} grupo(s) associado(s).`
                                        : 'Sem grupos associados neste momento.',
                                    )}</p>
                                  </div>
                                </details>
                              `
                            : ''
                        }
                      </article>
                    `,
                  )
                  .join('')
              : `
                  <div class="timeline-item">
                    <strong>Sem pessoas conhecidas</strong>
                    <time>Assim que o runtime reconhecer pessoas, esta lista passa a ficar gerivel aqui.</time>
                  </div>
                `}
          </div>
          <details class="ui-details">
            <summary>Conversas privadas conhecidas</summary>
            <div class="ui-details__content">
              <div class="timeline">
                ${snapshot.conversations.length > 0
                  ? snapshot.conversations
                      .map(
                        (conversation) => `
                          <article class="timeline-item">
                            <strong>${escapeHtml(conversation.displayName)}</strong>
                            <time>${escapeHtml(conversation.privateAssistantAuthorized ? 'Privado permitido' : 'Privado bloqueado')}</time>
                            <p>${escapeHtml(
                              conversation.ownedGroupJids.length > 0
                                ? `${conversation.ownedGroupJids.length} grupo(s) associado(s)`
                                : 'Sem grupos associados',
                            )}</p>
                          </article>
                        `,
                      )
                      .join('')
                  : `
                      <div class="timeline-item">
                        <strong>Sem privados conhecidos</strong>
                        <time>Quando houver conversas privadas reconhecidas, aparecem aqui.</time>
                      </div>
                    `}
              </div>
            </div>
          </details>
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-12">
          <div class="card-header">
            <div>
              <h3>Grupos do WhatsApp</h3>
              <p>O foco aqui e simples: ligar ou bloquear o assistente, rever responsaveis e ajustar acessos quando fizer falta.</p>
            </div>
            ${renderUiBadge({ label: `${snapshot.groups.length} grupos`, tone: 'neutral' })}
          </div>
          <div class="group-access-grid">
            ${snapshot.groups
              .map(
                (group) => `
                  ${renderUiRecordCard({
                    title: group.preferredSubject,
                    subtitle: group.ownerLabels.join(', ') || 'Sem responsavel definido',
                    badgeLabel: group.assistantAuthorized ? 'Ligado' : 'Bloqueado',
                    badgeTone: group.assistantAuthorized ? 'positive' : 'warning',
                    bodyHtml: `
                      <p><strong>Assistente</strong>: ${escapeHtml(
                        group.assistantAuthorized ? 'ligado neste grupo' : 'bloqueado neste grupo',
                      )}.</p>
                      <p><strong>Calendario</strong>: ${escapeHtml(
                        `Membros ${readableCalendarAccessMode(group.calendarAccessPolicy.group)}, Responsavel ${readableCalendarAccessMode(group.calendarAccessPolicy.groupOwner)}, Admin ${readableCalendarAccessMode(group.calendarAccessPolicy.appOwner)}.`,
                      )}</p>
                      <div class="action-row">
                        ${renderUiActionButton({
                          label: group.assistantAuthorized ? 'Bloquear grupo' : 'Autorizar grupo',
                          variant: group.assistantAuthorized ? 'secondary' : 'primary',
                          dataAttributes: {
                            'whatsapp-action': 'toggle-group-authorized',
                            'group-jid': group.groupJid,
                          },
                        })}
                      </div>
                      <details class="ui-details">
                        <summary>Editar responsaveis e acessos</summary>
                        <div class="ui-details__content">
                          <div class="ui-card__chips">
                            ${people
                              .filter((person) => person.personId)
                              .map((person) =>
                                renderUiActionButton({
                                  label: person.displayName,
                                  variant:
                                    person.personId && group.ownerPersonIds.includes(person.personId)
                                      ? 'primary'
                                      : 'secondary',
                                  dataAttributes: {
                                    'whatsapp-action': 'toggle-group-owner',
                                    'group-jid': group.groupJid,
                                    'person-id': person.personId ?? '',
                                  },
                                }),
                              )
                              .join('')}
                          </div>
                          ${
                            group.ownerPersonIds.length > 0
                              ? `
                                <div class="action-row">
                                  ${renderUiActionButton({
                                    label: 'Limpar responsaveis',
                                    variant: 'secondary',
                                    dataAttributes: {
                                      'whatsapp-action': 'clear-group-owners',
                                      'group-jid': group.groupJid,
                                    },
                                  })}
                                </div>
                              `
                              : ''
                          }
                          <div class="acl-access-list">
                            ${renderWhatsAppAclField(group.groupJid, 'group', group.calendarAccessPolicy.group)}
                            ${renderWhatsAppAclField(group.groupJid, 'groupOwner', group.calendarAccessPolicy.groupOwner)}
                            ${renderWhatsAppAclField(group.groupJid, 'appOwner', group.calendarAccessPolicy.appOwner)}
                          </div>
                        </div>
                      </details>
                    `,
                    detailsSummary: this.state.advancedDetailsEnabled ? 'Detalhes avancados' : undefined,
                    detailsHtml: this.state.advancedDetailsEnabled
                      ? `
                          <p>JID: ${escapeHtml(group.groupJid)}</p>
                          <p>Alias: ${escapeHtml(group.aliases.join(', ') || 'sem alias')}</p>
                        `
                      : undefined,
                  })}
                `,
              )
              .join('')}
          </div>
        </article>
      </section>
    `;
  }

  private renderRoutingPage(page: UiPage<RoutingConsoleSnapshot>): string {
    const snapshot = page.data;
    const draft = resolveDistributionDraft(this.state.distributionDraft, snapshot.rules);
    const selectedRule = snapshot.rules.find((rule) => rule.ruleId === draft.ruleId) ?? null;
    const targetLabels = (selectedRule?.targetGroupJids ?? []).map(
      (groupJid) => snapshot.groups.find((group) => group.groupJid === groupJid)?.preferredSubject ?? groupJid,
    );

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Distribuicoes</p>
          <h2>Regras declarativas e campanhas em andamento numa vista mais legivel.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({
              label: 'Preparar preview',
              dataAttributes: { 'flow-action': 'distribution-save' },
            })}
            ${renderUiActionButton({
              label: 'Limpar fluxo',
              variant: 'secondary',
              dataAttributes: { 'flow-action': 'distribution-clear' },
            })}
          </div>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Atividade',
            badgeLabel: `${snapshot.distributions.length} distribuicoes`,
            badgeTone: 'neutral',
            contentHtml: `<p>${escapeHtml(`${snapshot.rules.length} regras ativas alimentam o plano de distribuicao multi-grupo.`)}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Fluxo guiado',
            badgeLabel: selectedRule ? 'Preview pronto' : 'Escolhe um remetente',
            badgeTone: selectedRule ? 'positive' : 'warning',
            contentHtml: '<p>Escreve a mensagem, valida os alvos e decide se queres confirmacao antes de distribuir.</p>',
          })}
        </div>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-5">
          <div class="card-header">
            <h3>Passo 1. Preparar a distribuicao</h3>
            ${renderUiBadge({ label: selectedRule ? 'Fluxo preenchido' : 'Falta escolher regra', tone: selectedRule ? 'positive' : 'warning' })}
          </div>
          ${
            snapshot.rules.length > 0
              ? `
                <div class="ui-form-grid">
                  ${renderUiSelectField({
                    label: 'Remetente / regra',
                    value: draft.ruleId,
                    dataKey: 'distribution.ruleId',
                    options: snapshot.rules.map((rule) => ({
                      value: rule.ruleId,
                      label: rule.personId ?? rule.ruleId,
                    })),
                    hint: 'A ideia aqui e preparar o fan-out sem expor JIDs ou detalhes internos.',
                  })}
                  ${renderUiSelectField({
                    label: 'Urgencia',
                    value: draft.urgency,
                    dataKey: 'distribution.urgency',
                    options: [
                      { value: 'normal', label: 'Normal' },
                      { value: 'hoje', label: 'Para hoje' },
                      { value: 'urgente', label: 'Urgente' },
                    ],
                  })}
                  ${renderUiSelectField({
                    label: 'Confirmacao',
                    value: draft.confirmationMode,
                    dataKey: 'distribution.confirmationMode',
                    options: [
                      { value: 'rule_default', label: 'Usar a regra atual' },
                      { value: 'force_confirmation', label: 'Pedir confirmacao' },
                      { value: 'direct', label: 'Distribuicao direta' },
                    ],
                  })}
                  ${renderUiTextAreaField({
                    label: 'Mensagem',
                    value: draft.messageSummary,
                    dataKey: 'distribution.messageSummary',
                    rows: 5,
                    placeholder: 'Ex.: Aula de amanha passa para sala 2. Confirmem rececao.',
                    hint: 'Escreve aqui a mensagem humana antes de espalhar pelos grupos.',
                  })}
                </div>
              `
              : `
                <section class="surface placeholder-card">
                  <div>
                    <p class="eyebrow">Sem regras</p>
                    <h3>Este fluxo precisa de pelo menos uma regra de routing</h3>
                    <p>Quando existirem regras, esta pagina passa a orientar a distribuicao passo a passo sem linguagem interna.</p>
                  </div>
                </section>
              `
          }
        </article>

        <article class="surface content-card span-7">
          <div class="card-header">
            <h3>Passo 2. Preview dos alvos</h3>
            ${renderUiBadge({ label: `${targetLabels.length} grupos alvo`, tone: targetLabels.length > 0 ? 'positive' : 'neutral' })}
          </div>
          <div class="guide-preview">
            <p><strong>Mensagem</strong>: ${escapeHtml(draft.messageSummary || 'Escreve primeiro a mensagem principal para veres o preview.')}</p>
            <p><strong>Urgencia</strong>: ${escapeHtml(draft.urgency)}</p>
            <p><strong>Confirmacao</strong>: ${escapeHtml(readableConfirmationMode(draft.confirmationMode, selectedRule?.requiresConfirmation ?? false))}</p>
          </div>
          <div class="ui-card__chips">
            ${
              targetLabels.length > 0
                ? targetLabels.map((label) => renderUiBadge({ label, tone: 'positive', style: 'chip' })).join('')
                : renderUiBadge({ label: 'Sem grupos alvo selecionados', tone: 'warning', style: 'chip' })
            }
          </div>
          <ul>
            <li>O preview ajuda a travar fan-out precipitado para grupos errados.</li>
            <li>Se houver confirmacao, a mensagem continua a chegar ao operador antes da distribuicao final.</li>
            <li>O botao acima ja cria preview real ou distribuicao real na fila, conforme o modo escolhido.</li>
          </ul>
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-5">
          <div class="card-header">
            <h3>Regras</h3>
          </div>
          <div class="card-grid">
            ${snapshot.rules
              .map(
                (rule) =>
                  renderUiRecordCard({
                    title: rule.personId ?? 'Pessoa sem mapeamento',
                    subtitle: rule.notes ?? 'Regra sem nota adicional',
                    badgeLabel: rule.requiresConfirmation ? 'Com confirmacao' : 'Direta',
                    badgeTone: rule.requiresConfirmation ? 'warning' : 'positive',
                    bodyHtml: `
                      <ul>
                        <li>${rule.targetGroupJids.length} grupos alvo</li>
                        <li>${rule.targetDisciplineCodes.length} disciplinas associadas</li>
                        <li>${rule.targetCourseIds.length} cursos associados</li>
                      </ul>
                    `,
                  }),
              )
              .join('')}
          </div>
        </article>
        <article class="surface content-card span-7">
          <div class="card-header">
            <h3>Distribuicoes recentes</h3>
          </div>
          <div class="card-grid">
            ${snapshot.distributions
              .map(
                (distribution) =>
                  renderUiRecordCard({
                    title: distribution.sourceType,
                    subtitle: formatShortDateTime(distribution.updatedAt),
                    badgeLabel: distribution.status,
                    badgeTone: toneFromDistribution(distribution.status),
                    bodyHtml: `
                      <ul>
                        <li>${distribution.targetGroupJids.length} grupos alvo</li>
                        <li>${distribution.actionCounts.completed} completos</li>
                        <li>${distribution.actionCounts.failed} falhados</li>
                      </ul>
                    `,
                    detailsSummary: this.state.advancedDetailsEnabled ? 'Detalhes avancados' : undefined,
                    detailsHtml: this.state.advancedDetailsEnabled
                      ? `
                          <p>Instruction ID: ${escapeHtml(distribution.instructionId)}</p>
                          <p>Source message: ${escapeHtml(distribution.sourceMessageId ?? 'manual')}</p>
                        `
                      : undefined,
                  }),
              )
              .join('')}
          </div>
        </article>
      </section>
    `;
  }

  private renderWatchdogPage(page: UiPage<readonly WatchdogIssue[]>): string {
    const issues = page.data.filter((issue) => !this.state.dismissedWatchdogIssueIds.includes(issue.issueId));
    const firstIssue = issues[0] ?? null;

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Watchdog</p>
          <h2>Problemas ativos vistos como uma inbox operacional, nao como log tecnico.</h2>
          <p>${escapeHtml(page.description)}</p>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Estado atual',
            badgeLabel: `${issues.length} abertas`,
            badgeTone: issues.length > 0 ? 'warning' : 'positive',
            contentHtml: `<p>${escapeHtml(
              issues.length > 0
                ? 'Convem rever estes atrasos antes de aumentar a carga operacional.'
                : 'Sem sinais criticos neste momento.',
            )}</p>`,
          })}
        </div>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-12">
          <div class="card-header">
            <h3>Fluxo guiado para resolver problema</h3>
            ${renderUiBadge({ label: firstIssue ? 'Ha uma proxima acao clara' : 'Sem fila pendente', tone: firstIssue ? 'warning' : 'positive' })}
          </div>
          ${
            firstIssue
              ? `
                <div class="content-grid">
                  <article class="surface content-card span-7">
                    <div class="card-header">
                      <h3>Comeca por aqui</h3>
                    </div>
                    <ul>
                      <li>Grupo: ${escapeHtml(firstIssue.groupLabel)}</li>
                      <li>Resumo: ${escapeHtml(firstIssue.summary)}</li>
                      <li>Tipo: ${escapeHtml(firstIssue.kind)}</li>
                      <li>Aberta: ${escapeHtml(formatShortDateTime(firstIssue.openedAt))}</li>
                    </ul>
                  </article>
                  <article class="surface content-card span-5">
                    <div class="card-header">
                      <h3>Passos recomendados</h3>
                    </div>
                    <ul>
                      <li>Confirmar se o atraso ou falha ainda se mantem.</li>
                      <li>Validar se houve entrega, confirmacao ou bloqueio real.</li>
                      <li>Marcar como revista quando terminares a verificacao.</li>
                    </ul>
                    <div class="action-row">
                      ${renderUiActionButton({
                        label: 'Marcar como revista nesta sessao',
                        dataAttributes: {
                          'flow-action': 'watchdog-dismiss',
                          'flow-value': firstIssue.issueId,
                        },
                      })}
                    </div>
                  </article>
                </div>
              `
              : `
                <p>Nao ha issues abertas. O fluxo guiado fica pronto para ser usado assim que aparecer um problema novo.</p>
              `
          }
        </article>
      </section>

      <section class="card-grid">
        ${
          issues.length > 0
            ? issues
                .map(
                  (issue) =>
                    renderUiRecordCard({
                      title: issue.groupLabel,
                      subtitle: issue.summary,
                      badgeLabel: issue.kind,
                      badgeTone: issue.status === 'open' ? 'warning' : 'positive',
                      bodyHtml: `
                        <ul>
                          <li>Status: ${escapeHtml(issue.status)}</li>
                          <li>Aberta: ${escapeHtml(formatShortDateTime(issue.openedAt))}</li>
                          <li>Semana: ${escapeHtml(issue.weekId)}</li>
                        </ul>
                      `,
                    }),
                )
                .join('')
            : `
              <article class="surface placeholder-card">
                <div>
                  <p class="eyebrow">Tudo calmo</p>
                  <h3>Sem issues abertas</h3>
                  <p>Esta vista continua pronta para crescer sem parecer vazia ou quebrada.</p>
                </div>
              </article>
            `
        }
      </section>
    `;
  }

  private renderMigrationPage(page: UiPage<MigrationPageData>): string {
    const snapshot = page.data.settings;
    const migrationReadiness = page.data.migrationReadiness;
    const authRouterStatus = snapshot.authRouterStatus;
    const migrationRecommendationTone =
      migrationReadiness.recommendedPhase === 'blocked'
        ? 'danger'
        : migrationReadiness.cutoverDecisionReady
          ? 'positive'
          : 'warning';
    const migrationRecommendationLabel =
      migrationReadiness.recommendedPhase === 'blocked'
        ? 'Ainda nao entrar em shadow mode'
        : migrationReadiness.cutoverDecisionReady
          ? 'Semana paralela pronta a arrancar'
          : 'Entrar em shadow mode';
    const activeAccount = authRouterStatus?.currentSelection?.accountId ?? null;

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Shadow mode</p>
          <h2>Semana paralela real e controlo do Codex auto router num unico sitio.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({ label: 'Ver WhatsApp', href: '/whatsapp', dataAttributes: { route: '/whatsapp' } })}
            ${renderUiActionButton({ label: 'Abrir assistente', href: '/assistant', variant: 'secondary', dataAttributes: { route: '/assistant' } })}
            ${renderUiActionButton({ label: 'Abrir configuracao base', href: '/settings', variant: 'secondary', dataAttributes: { route: '/settings' } })}
          </div>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Fase recomendada',
            badgeLabel: migrationRecommendationLabel,
            badgeTone: migrationRecommendationTone,
            contentHtml: `<p>${escapeHtml(migrationReadiness.summary)}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Codex auto router',
            badgeLabel: authRouterStatus?.currentSelection ? authRouterStatus.currentSelection.label : 'Sem selecao',
            badgeTone: authRouterStatus?.currentSelection ? 'positive' : 'warning',
            contentHtml: `<p>${
              authRouterStatus
                ? escapeHtml(`Conta ativa: ${authRouterStatus.currentSelection?.label ?? 'nenhuma'} · ${authRouterStatus.accountCount} conta(s) visivel/visiveis.`)
                : 'Router indisponivel neste runtime.'
            }</p>`,
          })}
        </div>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-8">
          <div class="card-header">
            <div>
              <h3>Readiness de migracao</h3>
              <p>O objetivo aqui e perceber se ja vale a pena operar uma semana real em paralelo com o WA-notify.</p>
            </div>
            ${renderUiBadge({ label: migrationRecommendationLabel, tone: migrationRecommendationTone })}
          </div>
          <div class="guide-preview">
            <p><strong>Fase recomendada</strong>: ${escapeHtml(migrationRecommendationLabel)}</p>
            <p>${escapeHtml(migrationReadiness.summary)}</p>
            <p><strong>Gerado em</strong>: ${escapeHtml(formatShortDateTime(migrationReadiness.generatedAt))}</p>
          </div>
          <div class="card-grid">
            ${renderUiMetricCard({
              title: 'Runtime',
              value: migrationReadiness.runtime.ready ? 'Pronto' : 'Parado',
              tone: migrationReadiness.runtime.ready ? 'positive' : 'danger',
              description:
                migrationReadiness.runtime.phase === 'running'
                  ? 'Backend a responder com tick operacional recente.'
                  : `Fase atual ${migrationReadiness.runtime.phase}.`,
            })}
            ${renderUiMetricCard({
              title: 'WhatsApp',
              value: migrationReadiness.whatsapp.connected ? 'Ligado' : 'Rever',
              tone: migrationReadiness.whatsapp.connected ? 'positive' : 'warning',
              description: `${migrationReadiness.whatsapp.discoveredGroups} grupos e ${migrationReadiness.whatsapp.discoveredConversations} conversas visiveis.`,
            })}
            ${renderUiMetricCard({
              title: 'LLM live',
              value: migrationReadiness.llm.mode === 'live' ? 'Provider real' : 'Fallback',
              tone: migrationReadiness.llm.mode === 'live' ? 'positive' : 'warning',
              description: `${migrationReadiness.llm.effectiveProvider} / ${migrationReadiness.llm.effectiveModel}`,
            })}
            ${renderUiMetricCard({
              title: 'Cutover',
              value: migrationReadiness.cutoverDecisionReady ? 'Pronto para decidir' : 'Ainda em comparacao',
              tone: migrationReadiness.cutoverDecisionReady ? 'positive' : 'warning',
              description: `${migrationReadiness.lumeHubState.importedScheduleEvents} eventos, ${migrationReadiness.lumeHubState.alertRules} alerts e ${migrationReadiness.lumeHubState.automationDefinitions} automations no runtime novo.`,
            })}
          </div>
          <details class="ui-details" open>
            <summary>Checklist objetiva</summary>
            <div class="ui-details__content">
              <div class="migration-readiness-list">
                ${migrationReadiness.checklist
                  .map(
                    (item) => `
                      <article class="migration-readiness-item migration-readiness-item--${item.status}">
                        <div class="migration-readiness-item__header">
                          <strong>${escapeHtml(item.label)}</strong>
                          ${renderUiBadge({
                            label:
                              item.status === 'ready'
                                ? 'Pronto'
                                : item.status === 'review'
                                  ? 'Rever'
                                  : 'Bloqueado',
                            tone:
                              item.status === 'ready'
                                ? 'positive'
                                : item.status === 'review'
                                  ? 'warning'
                                  : 'danger',
                          })}
                        </div>
                        <p>${escapeHtml(item.summary)}</p>
                      </article>
                    `,
                  )
                  .join('')}
              </div>
            </div>
          </details>
        </article>
        <article class="surface content-card span-4">
          <div class="card-header">
            <div>
              <h3>Operacao da semana paralela</h3>
              <p>O que comparar e o que fechar antes de decidir o corte final.</p>
            </div>
            ${renderUiBadge({
              label: migrationReadiness.recommendedPhase === 'blocked' ? 'Bloqueada' : 'Em preparacao',
              tone: migrationReadiness.recommendedPhase === 'blocked' ? 'danger' : 'warning',
            })}
          </div>
          <details class="ui-details" open>
            <summary>Comparacao curta WA-notify vs LumeHub</summary>
            <div class="ui-details__content">
              <div class="migration-comparison-list">
                ${migrationReadiness.comparison
                  .map(
                    (entry) => `
                      <article class="migration-comparison-item">
                        <div class="migration-readiness-item__header">
                          <strong>${escapeHtml(entry.label)}</strong>
                          ${renderUiBadge({
                            label: entry.tone === 'positive' ? 'Alinhado' : entry.tone === 'warning' ? 'Rever' : 'Info',
                            tone: entry.tone,
                          })}
                        </div>
                        <p><strong>WA-notify</strong>: ${escapeHtml(entry.waNotify)}</p>
                        <p><strong>LumeHub</strong>: ${escapeHtml(entry.lumeHub)}</p>
                      </article>
                    `,
                  )
                  .join('')}
              </div>
            </div>
          </details>
          <details class="ui-details" open>
            <summary>O que fazer durante a semana paralela</summary>
            <div class="ui-details__content">
              <ul>
                ${migrationReadiness.shadowModeChecks.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </div>
          </details>
          <details class="ui-details">
            <summary>Antes do cutover</summary>
            <div class="ui-details__content">
              <ul>
                ${migrationReadiness.cutoverChecks.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </div>
          </details>
          ${
            migrationReadiness.blockers.length > 0
              ? `
                  <details class="ui-details" open>
                    <summary>Bloqueadores atuais</summary>
                    <div class="ui-details__content">
                      <ul>
                        ${migrationReadiness.blockers.map((blocker) => `<li>${escapeHtml(blocker)}</li>`).join('')}
                      </ul>
                    </div>
                  </details>
                `
              : ''
          }
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-4">
          <div class="card-header">
            <div>
              <h3>Codex auto router</h3>
              <p>Escolhe ou prepara a auth ativa do Codex sem mexer em ficheiros manualmente.</p>
            </div>
            ${renderUiBadge({
              label: authRouterStatus?.currentSelection ? 'Operacional' : 'Indisponivel',
              tone: authRouterStatus?.currentSelection ? 'positive' : 'warning',
            })}
          </div>
          ${
            authRouterStatus
              ? `
                  <div class="guide-preview">
                    <p><strong>Conta ativa</strong>: ${escapeHtml(authRouterStatus.currentSelection?.label ?? 'Nenhuma')}</p>
                    <p><strong>Canonical auth</strong>: ${escapeHtml(authRouterStatus.canonicalAuthFilePath)}</p>
                    <p><strong>Ultimo prepare</strong>: ${escapeHtml(formatShortDateTime(authRouterStatus.lastPreparedAt))}</p>
                    <p><strong>Ultima troca</strong>: ${escapeHtml(formatShortDateTime(authRouterStatus.lastSwitchAt))}</p>
                  </div>
                  <div class="action-row">
                    ${renderUiActionButton({
                      label: 'Atualizar estado',
                      variant: 'secondary',
                      dataAttributes: { 'settings-action': 'refresh-migration' },
                    })}
                    ${renderUiActionButton({
                      label: 'Preparar melhor conta agora',
                      dataAttributes: { 'settings-action': 'prepare-codex-router' },
                    })}
                  </div>
                  <div class="card-grid">
                    ${renderUiMetricCard({
                      title: 'Conta em uso',
                      value: authRouterStatus.currentSelection?.label ?? 'Nenhuma',
                      tone: authRouterStatus.currentSelection ? 'positive' : 'warning',
                      description: authRouterStatus.currentSelection?.sourceFilePath ?? 'Ainda nao ha selecao ativa.',
                    })}
                    ${renderUiMetricCard({
                      title: 'Contas visiveis',
                      value: String(authRouterStatus.accountCount),
                      tone: authRouterStatus.accountCount > 0 ? 'positive' : 'warning',
                      description: authRouterStatus.accounts.length > 0 ? 'Fontes de auth conhecidas pelo router.' : 'Sem contas conhecidas.',
                    })}
                    ${renderUiMetricCard({
                      title: 'Canonical auth',
                      value: authRouterStatus.canonicalExists ? 'Presente' : 'Em falta',
                      tone: authRouterStatus.canonicalExists ? 'positive' : 'warning',
                      description: authRouterStatus.canonicalAuthFilePath,
                    })}
                    ${renderUiMetricCard({
                      title: 'Ultimo erro',
                      value: authRouterStatus.lastError ? 'Rever' : 'Sem erro',
                      tone: authRouterStatus.lastError ? 'warning' : 'positive',
                      description: authRouterStatus.lastError ?? 'Sem erro recente registado pelo router.',
                    })}
                  </div>
                  <details class="ui-details">
                    <summary>Historico recente</summary>
                    <div class="ui-details__content">
                      <ul>
                        ${
                          authRouterStatus.switchHistory.length > 0
                            ? authRouterStatus.switchHistory
                                .slice()
                                .reverse()
                                .slice(0, 8)
                                .map(
                                  (entry) =>
                                    `<li>${escapeHtml(formatShortDateTime(entry.createdAt))} · ${escapeHtml(entry.event)} · ${escapeHtml(entry.label ?? entry.accountId ?? 'sem conta')}${entry.reason ? ` · ${escapeHtml(entry.reason)}` : ''}</li>`,
                                )
                                .join('')
                            : '<li>Sem historico recente de prepare ou troca.</li>'
                        }
                      </ul>
                    </div>
                  </details>
                `
              : '<p>O router do Codex nao esta configurado neste runtime.</p>'
          }
        </article>
        <article class="surface content-card span-8">
          <div class="card-header">
            <div>
              <h3>Contas conhecidas pelo router</h3>
              <p>Usa esta lista para perceber o estado de cada auth e escolher uma conta concreta quando precisares.</p>
            </div>
            ${renderUiBadge({
              label: `${authRouterStatus?.accounts.length ?? 0} conta(s)`,
              tone: authRouterStatus?.accounts.length ? 'neutral' : 'warning',
            })}
          </div>
          ${
            authRouterStatus && authRouterStatus.accounts.length > 0
              ? `
                  <div class="codex-router-account-list">
                    ${authRouterStatus.accounts
                      .map(
                        (account) => `
                          <article class="codex-router-account-card">
                            <div class="card-header">
                              <div>
                                <h4>${escapeHtml(account.label)}</h4>
                                <p>${escapeHtml(account.sourceFilePath)}</p>
                              </div>
                              <div class="codex-router-account-badges">
                                ${renderUiBadge({
                                  label: account.accountId === activeAccount ? 'Em uso agora' : account.exists ? 'Disponivel' : 'Em falta',
                                  tone: account.accountId === activeAccount ? 'positive' : account.exists ? 'neutral' : 'warning',
                                })}
                                ${renderUiBadge({
                                  label: account.kind === 'canonical_live' ? 'Canonical' : 'Secundaria',
                                  tone: account.kind === 'canonical_live' ? 'neutral' : 'warning',
                                  style: 'chip',
                                })}
                              </div>
                            </div>
                            <ul>
                              <li><strong>Prioridade</strong>: ${account.priority}</li>
                              <li><strong>Sucessos</strong>: ${account.usage.successCount} · <strong>Falhas</strong>: ${account.usage.failureCount}</li>
                              <li><strong>Ultimo sucesso</strong>: ${escapeHtml(formatShortDateTime(account.usage.lastSuccessAt))}</li>
                              <li><strong>Ultima falha</strong>: ${escapeHtml(formatShortDateTime(account.usage.lastFailureAt))}${account.usage.lastFailureReason ? ` · ${escapeHtml(account.usage.lastFailureReason)}` : ''}</li>
                              <li><strong>Cooldown</strong>: ${escapeHtml(formatShortDateTime(account.usage.cooldownUntil))}</li>
                            </ul>
                            <div class="action-row">
                              ${renderUiActionButton({
                                label: account.accountId === activeAccount ? 'Conta ativa' : 'Trocar para esta conta',
                                variant: account.accountId === activeAccount ? 'secondary' : 'primary',
                                disabled: !account.exists || account.accountId === activeAccount,
                                dataAttributes: {
                                  'settings-action': 'switch-codex-account',
                                  'codex-account-id': account.accountId,
                                },
                              })}
                            </div>
                          </article>
                        `,
                      )
                      .join('')}
                  </div>
                `
              : '<p>Sem contas conhecidas para o router neste momento.</p>'
          }
        </article>
      </section>
    `;
  }

  private renderSettingsPage(page: UiPage<SettingsPageData>): string {
    const snapshot = page.data.settings;
    const legacyFiles = page.data.legacyScheduleImportFiles;
    const draft = resolveLegacyScheduleMigrationDraft(
      this.state.legacyScheduleMigrationDraft,
      legacyFiles,
      page.data.legacyScheduleImportReport,
    );
    const alertDraft = resolveLegacyAlertMigrationDraft(
      this.state.legacyAlertMigrationDraft,
      page.data.legacyAlertImportReport,
    );
    const automationDraft = resolveLegacyAutomationMigrationDraft(
      this.state.legacyAutomationMigrationDraft,
      page.data.legacyAutomationImportReport,
    );
    const selectedLegacyFile = legacyFiles.find((file) => file.fileName === draft.fileName) ?? legacyFiles[0] ?? null;
    const defaultRuleSummary =
      snapshot.adminSettings.ui.defaultNotificationRules.length > 0
        ? snapshot.adminSettings.ui.defaultNotificationRules
            .map((rule) => rule.label ?? rule.kind)
            .slice(0, 2)
            .join(', ')
        : 'Sem regras default';
    const llmTone =
      snapshot.llmRuntime.mode === 'live'
        ? 'positive'
        : snapshot.llmRuntime.mode === 'fallback'
          ? 'warning'
          : 'neutral';
    const llmStatusLabel =
      snapshot.llmRuntime.mode === 'live'
        ? 'Provider real ativo'
        : snapshot.llmRuntime.mode === 'fallback'
          ? 'Fallback deterministico'
          : 'LLM live desligada';
    const alertRulesCount = snapshot.adminSettings.alerts.rules.length;
    const automationDefinitionsCount = snapshot.adminSettings.automations.definitions.length;

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Configuracao avancada</p>
          <h2>Zona secundaria para o que raramente precisas de mexer no dia a dia.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({ label: 'Abrir migracao', href: '/migration', variant: 'secondary', dataAttributes: { route: '/migration' } })}
          </div>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Resumo rapido',
            badgeLabel: 'Sob demanda',
            badgeTone: 'neutral',
            contentHtml: '<p>Usa esta pagina so quando precisares de defaults, energia, host ou auth. O fluxo principal continua fora daqui.</p>',
          })}
        </div>
      </section>
      <section class="card-grid">
        ${renderUiMetricCard({
          title: 'Avisos default',
          value: String(snapshot.adminSettings.ui.defaultNotificationRules.length),
          tone: snapshot.adminSettings.ui.defaultNotificationRules.length > 0 ? 'positive' : 'neutral',
          description: defaultRuleSummary,
        })}
        ${renderUiMetricCard({
          title: 'LLM live',
          value: llmStatusLabel,
          tone: llmTone,
          description: `${snapshot.llmRuntime.effectiveProviderId} / ${snapshot.llmRuntime.effectiveModelId}`,
        })}
        ${renderUiMetricCard({
          title: 'Energia',
          value: snapshot.powerStatus.inhibitorActive ? 'Ativa' : 'Normal',
          tone: snapshot.powerStatus.inhibitorActive ? 'warning' : 'neutral',
          description: snapshot.powerStatus.policy.enabled ? 'A politica de energia esta ligada.' : 'A politica de energia esta desligada.',
        })}
        ${renderUiMetricCard({
          title: 'Host e auth',
          value: snapshot.hostStatus.auth.sameAsCodexCanonical ? 'Partilhado' : 'Isolado',
          tone: snapshot.hostStatus.auth.sameAsCodexCanonical ? 'positive' : 'warning',
          description: snapshot.hostStatus.autostart.enabled ? 'Autostart ligado no host companion.' : 'Autostart desligado no host companion.',
        })}
      </section>
      <section class="content-grid">
        <article class="surface content-card span-12">
          <div class="card-header">
            <div>
              <h3>Ajustes avancados</h3>
              <p>Abre so a secao de que precisas. O resto pode continuar fora do teu caminho.</p>
            </div>
            ${renderUiBadge({ label: 'Secundario', tone: 'neutral' })}
          </div>
          <details class="ui-details">
            <summary>Avisos default</summary>
            <div class="ui-details__content">
              <ul>
                ${snapshot.adminSettings.ui.defaultNotificationRules
                  .map(
                    (rule) =>
                      `<li>${escapeHtml(rule.label ?? rule.kind)} - ${escapeHtml(rule.localTime ?? `${rule.daysBeforeEvent ?? 0}d / ${rule.offsetMinutesBeforeEvent ?? 0}m`)}</li>`,
                  )
                  .join('')}
              </ul>
            </div>
          </details>
          <details class="ui-details" open>
            <summary>LLM live e provider</summary>
            <div class="ui-details__content">
              <ul>
                <li>Configurado: ${escapeHtml(snapshot.adminSettings.llm.provider)} / ${escapeHtml(snapshot.adminSettings.llm.model)}</li>
                <li>Em uso agora: ${escapeHtml(snapshot.llmRuntime.effectiveProviderId)} / ${escapeHtml(snapshot.llmRuntime.effectiveModelId)}</li>
                <li>Estado: ${escapeHtml(llmStatusLabel)}</li>
                ${
                  snapshot.llmRuntime.fallbackReason
                    ? `<li>Motivo atual: ${escapeHtml(snapshot.llmRuntime.fallbackReason)}</li>`
                    : ''
                }
                <li>
                  Auth do Codex: ${escapeHtml(
                    snapshot.llmRuntime.providerReadiness.find((provider) => provider.providerId === 'codex-oauth')?.ready
                      ? `pronta (${snapshot.authRouterStatus?.accountCount ?? 0} conta(s) visiveis)`
                      : snapshot.llmRuntime.providerReadiness.find((provider) => provider.providerId === 'codex-oauth')?.reason ??
                          'indisponivel',
                  )}
                </li>
              </ul>
            </div>
          </details>
          <details class="ui-details">
            <summary>Energia</summary>
            <div class="ui-details__content">
              <ul>
                <li>Modo: ${escapeHtml(snapshot.powerStatus.policy.mode)}</li>
                <li>Politica ativa: ${snapshot.powerStatus.policy.enabled ? 'sim' : 'nao'}</li>
                <li>Razoes: ${escapeHtml(snapshot.powerStatus.reasons.join(', ') || 'nenhuma')}</li>
              </ul>
            </div>
          </details>
          <details class="ui-details">
            <summary>Host e auth</summary>
            <div class="ui-details__content">
              <ul>
                <li>Auth live presente: ${snapshot.hostStatus.auth.exists ? 'sim' : 'nao'}</li>
                <li>Mesmo auth do Codex: ${snapshot.hostStatus.auth.sameAsCodexCanonical ? 'sim' : 'nao'}</li>
                <li>Heartbeat: ${escapeHtml(formatShortDateTime(snapshot.hostStatus.runtime.lastHeartbeatAt))}</li>
              </ul>
              ${
                this.state.advancedDetailsEnabled
                  ? `
                      <details class="ui-details">
                        <summary>Detalhes avancados</summary>
                        <div class="ui-details__content">
                          <p>Auth file: ${escapeHtml(snapshot.hostStatus.auth.filePath)}</p>
                          <p>Service: ${escapeHtml(snapshot.hostStatus.autostart.serviceName)}</p>
                        </div>
                      </details>
                    `
                  : ''
              }
            </div>
          </details>
          <details class="ui-details" open>
            <summary>Migracao de schedules do WA-notify</summary>
            <div class="ui-details__content">
              ${
                legacyFiles.length > 0
                  ? `
                      <div class="ui-form-grid">
                        ${renderUiSelectField({
                          label: 'Ficheiro legacy',
                          value: draft.fileName,
                          dataKey: 'migration.fileName',
                          options: legacyFiles.map((file) => ({
                            value: file.fileName,
                            label: `${file.fileName} · ${file.baseEventCount} eventos`,
                          })),
                          hint: 'Escolhe a semana legacy a analisar antes de importar.',
                        })}
                      </div>
                      <div class="action-row">
                        ${renderUiActionButton({
                          label: draft.previewLoading ? 'A gerar preview...' : 'Gerar preview do import',
                          disabled: draft.previewLoading || draft.applying || !selectedLegacyFile,
                          dataAttributes: { 'settings-action': 'preview-legacy-import' },
                        })}
                        ${renderUiActionButton({
                          label: draft.applying ? 'A importar...' : 'Importar para o calendario real',
                          variant: 'secondary',
                          disabled: draft.previewLoading || draft.applying || !selectedLegacyFile,
                          dataAttributes: { 'settings-action': 'apply-legacy-import' },
                        })}
                        ${
                          draft.report
                            ? renderUiActionButton({
                                label: 'Limpar relatorio',
                                variant: 'secondary',
                                dataAttributes: { 'settings-action': 'clear-legacy-import-report' },
                              })
                            : ''
                        }
                      </div>
                      ${
                        selectedLegacyFile
                          ? `
                              <ul>
                                <li>Semana legacy: ${escapeHtml(selectedLegacyFile.legacyWeekId)}</li>
                                <li>Semana ISO alvo: ${escapeHtml(selectedLegacyFile.isoWeekId ?? 'indefinida')}</li>
                                <li>Janela temporal: ${escapeHtml(
                                  selectedLegacyFile.weekStart && selectedLegacyFile.weekEnd
                                    ? `${selectedLegacyFile.weekStart} ate ${selectedLegacyFile.weekEnd}`
                                    : 'sem range declarada',
                                )}</li>
                                <li>Itens no ficheiro: ${selectedLegacyFile.itemCount}; eventos base: ${selectedLegacyFile.baseEventCount}</li>
                              </ul>
                            `
                          : ''
                      }
                    `
                  : '<p>Nao foi encontrado nenhum ficheiro legacy do WA-notify nesta instalacao.</p>'
              }
              ${
                draft.report
                  ? `
                      <div class="guide-preview">
                        <p><strong>Modo</strong>: ${escapeHtml(draft.report.mode === 'apply' ? 'Import aplicado' : 'Preview') }</p>
                        <p><strong>Ficheiro</strong>: ${escapeHtml(draft.report.sourceFile.fileName)}</p>
                        <p><strong>Criados</strong>: ${draft.report.totals.created} · <strong>Atualizados</strong>: ${draft.report.totals.updated} · <strong>Iguais</strong>: ${draft.report.totals.unchanged}</p>
                        <p><strong>Ambiguos</strong>: ${draft.report.totals.ambiguous} · <strong>Grupos em falta</strong>: ${draft.report.totals.missingGroups}</p>
                      </div>
                      ${
                        draft.report.missingGroups.length > 0
                          ? `
                              <details class="ui-details">
                                <summary>Grupos em falta</summary>
                                <div class="ui-details__content">
                                  <ul>
                                    ${draft.report.missingGroups
                                      .map(
                                        (entry) =>
                                          `<li>${escapeHtml(entry.groupJid)} · ${entry.itemCount} item(ns) legacy sem mapeamento</li>`,
                                      )
                                      .join('')}
                                  </ul>
                                </div>
                              </details>
                            `
                          : ''
                      }
                      <details class="ui-details">
                        <summary>Eventos avaliados</summary>
                        <div class="ui-details__content">
                          <ul>
                            ${draft.report.events
                              .slice(0, 8)
                              .map(
                                (event) =>
                                  `<li>${escapeHtml(event.title)} · ${escapeHtml(event.groupLabel ?? event.groupJid)} · ${escapeHtml(event.localDate)} ${escapeHtml(event.startTime)} · ${escapeHtml(event.status)}${event.reason ? ` · ${escapeHtml(event.reason)}` : ''}</li>`,
                              )
                              .join('')}
                          </ul>
                        </div>
                      </details>
                    `
                  : ''
              }
            </div>
          </details>
          <details class="ui-details">
            <summary>Migracao de alerts do WA-notify</summary>
            <div class="ui-details__content">
              <p>Regras de alerta atuais: <strong>${alertRulesCount}</strong>.</p>
              <div class="action-row">
                ${renderUiActionButton({
                  label: alertDraft.previewLoading ? 'A gerar preview...' : 'Gerar preview dos alerts',
                  disabled: alertDraft.previewLoading || alertDraft.applying,
                  dataAttributes: { 'settings-action': 'preview-alerts-import' },
                })}
                ${renderUiActionButton({
                  label: alertDraft.applying ? 'A importar...' : 'Importar alerts',
                  variant: 'secondary',
                  disabled: alertDraft.previewLoading || alertDraft.applying,
                  dataAttributes: { 'settings-action': 'apply-alerts-import' },
                })}
                ${
                  alertDraft.report
                    ? renderUiActionButton({
                        label: 'Limpar relatorio',
                        variant: 'secondary',
                        dataAttributes: { 'settings-action': 'clear-alerts-import-report' },
                      })
                    : ''
                }
              </div>
              ${
                alertDraft.report
                  ? `
                      <div class="guide-preview">
                        <p><strong>Modo</strong>: ${escapeHtml(alertDraft.report.mode === 'apply' ? 'Import aplicado' : 'Preview')}</p>
                        <p><strong>Ficheiro</strong>: ${escapeHtml(alertDraft.report.sourceFilePath)}</p>
                        <p><strong>Regras legacy</strong>: ${alertDraft.report.totals.legacyRules} · <strong>Importadas</strong>: ${alertDraft.report.totals.importedRules}</p>
                      </div>
                    `
                  : ''
              }
              <details class="ui-details">
                <summary>Regras importadas</summary>
                <div class="ui-details__content">
                  <ul>
                    ${(alertDraft.report?.rules ?? snapshot.adminSettings.alerts.rules.map((rule) => ({
                      ruleId: rule.ruleId,
                      enabled: rule.enabled,
                      scopeLabel:
                        rule.scope.type === 'group'
                          ? `grupo ${rule.scope.groupJid}`
                          : rule.scope.type === 'group_subject'
                            ? `grupo ${rule.scope.subject}`
                            : rule.scope.type === 'chat'
                              ? `chat ${rule.scope.chatJid}`
                              : 'qualquer chat',
                      matcherLabel:
                        rule.match.type === 'regex'
                          ? `regex ${rule.match.pattern}`
                          : `contains ${rule.match.value}`,
                      actionLabels: rule.actions.map((action) =>
                        action.type === 'webhook' ? `webhook ${action.url}` : 'log',
                      ),
                    })))
                      .slice(0, 8)
                      .map(
                        (rule) =>
                          `<li>${escapeHtml(rule.ruleId)} · ${escapeHtml(rule.scopeLabel)} · ${escapeHtml(rule.matcherLabel)} · ${escapeHtml(rule.actionLabels.join(', '))}</li>`,
                      )
                      .join('')}
                  </ul>
                </div>
              </details>
              <details class="ui-details">
                <summary>Matches recentes</summary>
                <div class="ui-details__content">
                  <ul>
                    ${page.data.recentAlertMatches.length > 0
                      ? page.data.recentAlertMatches
                          .map(
                            (match: MessageAlertMatchSnapshot) =>
                              `<li>${escapeHtml(match.ruleId)} · ${escapeHtml(match.text)} · ${escapeHtml(formatShortDateTime(match.matchedAt))}</li>`,
                          )
                          .join('')
                      : '<li>Sem matches recentes nesta instalacao.</li>'}
                  </ul>
                </div>
              </details>
            </div>
          </details>
          <details class="ui-details">
            <summary>Migracao de automations do WA-notify</summary>
            <div class="ui-details__content">
              <p>Automations atuais: <strong>${automationDefinitionsCount}</strong>.</p>
              <div class="action-row">
                ${renderUiActionButton({
                  label: automationDraft.previewLoading ? 'A gerar preview...' : 'Gerar preview das automations',
                  disabled: automationDraft.previewLoading || automationDraft.applying,
                  dataAttributes: { 'settings-action': 'preview-automations-import' },
                })}
                ${renderUiActionButton({
                  label: automationDraft.applying ? 'A importar...' : 'Importar automations',
                  variant: 'secondary',
                  disabled: automationDraft.previewLoading || automationDraft.applying,
                  dataAttributes: { 'settings-action': 'apply-automations-import' },
                })}
                ${
                  automationDraft.report
                    ? renderUiActionButton({
                        label: 'Limpar relatorio',
                        variant: 'secondary',
                        dataAttributes: { 'settings-action': 'clear-automations-import-report' },
                      })
                    : ''
                }
              </div>
              ${
                automationDraft.report
                  ? `
                      <div class="guide-preview">
                        <p><strong>Modo</strong>: ${escapeHtml(automationDraft.report.mode === 'apply' ? 'Import aplicado' : 'Preview')}</p>
                        <p><strong>Ficheiro</strong>: ${escapeHtml(automationDraft.report.sourceFilePath)}</p>
                        <p><strong>Entradas legacy</strong>: ${automationDraft.report.totals.legacyEntries} · <strong>Importadas</strong>: ${automationDraft.report.totals.importedDefinitions}</p>
                        <p><strong>Grupos em falta</strong>: ${automationDraft.report.totals.missingGroups}</p>
                      </div>
                    `
                  : ''
              }
              <details class="ui-details">
                <summary>Automations importadas</summary>
                <div class="ui-details__content">
                  <ul>
                    ${(automationDraft.report?.definitions ?? snapshot.adminSettings.automations.definitions.map((definition) => ({
                      automationId: definition.automationId,
                      entryId: definition.entryId,
                      groupJid: definition.groupJid,
                      groupLabel: definition.groupLabel,
                      scheduleLabel:
                        definition.schedule.type === 'weekly'
                          ? `${definition.schedule.daysOfWeek.join(', ')} @ ${definition.schedule.time}`
                          : definition.schedule.startsAt,
                      actionLabels: definition.actions.map((action) =>
                        action.type === 'webhook' ? `webhook ${action.url}` : action.type,
                      ),
                    })))
                      .slice(0, 8)
                      .map(
                        (definition) =>
                          `<li>${escapeHtml(definition.entryId)} · ${escapeHtml(definition.groupLabel)} · ${escapeHtml(definition.scheduleLabel)} · ${escapeHtml(definition.actionLabels.join(', '))}</li>`,
                      )
                      .join('')}
                  </ul>
                </div>
              </details>
              <details class="ui-details">
                <summary>Execucoes recentes</summary>
                <div class="ui-details__content">
                  <ul>
                    ${page.data.recentAutomationRuns.length > 0
                      ? page.data.recentAutomationRuns
                          .map(
                            (run: AutomationRunSnapshot) =>
                              `<li>${escapeHtml(run.entryId)} · ${escapeHtml(run.groupLabel)} · ${escapeHtml(run.status)} · ${escapeHtml(formatShortDateTime(run.firedAt))}</li>`,
                          )
                          .join('')
                      : '<li>Sem execucoes recentes nesta instalacao.</li>'}
                  </ul>
                </div>
              </details>
            </div>
          </details>
        </article>
      </section>
    `;
  }

  private renderGenericPage(page: UiPage): string {
    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">${escapeHtml(page.title)}</p>
          <h2>${escapeHtml(page.title)}</h2>
          <p>${escapeHtml(page.description)}</p>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Objetivo desta pagina',
            contentHtml:
              '<p>Esta pagina resume o estado atual desta area sem exigir leitura tecnica para perceber o essencial.</p>',
          })}
        </div>
      </section>
      <section class="card-grid">
        ${page.sections
          .map(
            (section) =>
              renderUiRecordCard({
                title: section.title,
                bodyHtml: `<ul>${section.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`,
              }),
          )
          .join('')}
      </section>
    `;
  }

  private renderStateCard(
    title: string,
    description: string,
    actions: readonly {
      readonly label: string;
      readonly value: string;
      readonly kind: 'mode' | 'preview';
    }[],
  ): string {
    return `
      <section class="surface state-card">
        <div>
          <p class="eyebrow">Estado global</p>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(description)}</p>
          <div class="action-row">
            ${actions
              .map((action) =>
                action.kind === 'mode'
                  ? renderUiActionButton({
                      label: action.label,
                      variant: action.value === 'demo' ? 'primary' : 'secondary',
                      dataAttributes: { mode: action.value },
                    })
                  : renderUiActionButton({
                      label: action.label,
                      variant: 'secondary',
                      dataAttributes: { preview: action.value },
                    }),
              )
              .join('')}
          </div>
        </div>
      </section>
    `;
  }

  private updateGuidedField(fieldKey: string, value: string): void {
    switch (fieldKey) {
      case 'schedule.groupJid':
      case 'schedule.title':
      case 'schedule.dayLabel':
      case 'schedule.startTime':
      case 'schedule.durationMinutes':
      case 'schedule.notes':
        this.state = {
          ...this.state,
          flowFeedback: null,
          scheduleDraft: {
            ...this.state.scheduleDraft,
            [fieldKey.replace('schedule.', '')]: value,
          } as GuidedScheduleDraft,
        };
        this.render();
        return;
      case 'distribution.ruleId':
      case 'distribution.messageSummary':
      case 'distribution.urgency':
      case 'distribution.confirmationMode':
        this.state = {
          ...this.state,
          flowFeedback: null,
          distributionDraft: {
            ...this.state.distributionDraft,
            [fieldKey.replace('distribution.', '')]: value,
          } as GuidedDistributionDraft,
        };
        this.render();
        return;
      case 'media.assetId': {
        const page = this.readMediaPageData();
        const asset = page?.data.assets.find((candidate) => candidate.assetId === value) ?? null;
        this.state = {
          ...this.state,
          flowFeedback: null,
          mediaDistributionDraft: {
            ...this.state.mediaDistributionDraft,
            assetId: value || null,
            caption: asset?.caption ?? '',
          },
        };
        this.render();
        return;
      }
      case 'media.caption':
        this.state = {
          ...this.state,
          flowFeedback: null,
          mediaDistributionDraft: {
            ...this.state.mediaDistributionDraft,
            caption: value,
          },
        };
        this.render();
        return;
      case 'group.instructions':
      case 'group.previewText':
        this.state = {
          ...this.state,
          flowFeedback: null,
          groupManagementDraft: {
            ...this.state.groupManagementDraft,
            [fieldKey === 'group.instructions' ? 'instructions' : 'previewText']: value,
          } as GroupManagementDraft,
        };
        this.render();
        return;
      case 'workspace.prompt':
      case 'workspace.query':
      case 'workspace.mode':
        this.state = {
          ...this.state,
          flowFeedback: null,
          workspaceAgentDraft: {
            ...this.state.workspaceAgentDraft,
            [fieldKey === 'workspace.prompt'
              ? 'prompt'
              : fieldKey === 'workspace.query'
                ? 'query'
                : 'mode']: fieldKey === 'workspace.mode' ? (value === 'plan' ? 'plan' : 'apply') : value,
          } as WorkspaceAgentDraft,
        };
        this.render();
        return;
      case 'assistant.groupJid':
      case 'assistant.text':
        this.state = {
          ...this.state,
          flowFeedback: null,
          assistantSchedulingDraft: {
            ...this.state.assistantSchedulingDraft,
            [fieldKey === 'assistant.groupJid' ? 'groupJid' : 'text']: value,
            ...(fieldKey === 'assistant.text' ? { preview: null, lastApplied: null } : {}),
          } as AssistantSchedulingDraft,
        };
        this.render();
        return;
      case 'migration.fileName':
        this.state = {
          ...this.state,
          flowFeedback: null,
          legacyScheduleMigrationDraft: {
            ...this.state.legacyScheduleMigrationDraft,
            fileName: value,
          },
        };
        this.render();
        return;
      case 'railChat.input':
        this.state = {
          ...this.state,
          flowFeedback: null,
          assistantRailChat: {
            ...this.state.assistantRailChat,
            input: value,
          },
        };
        this.render();
        return;
      case 'railChat.groupJid':
        this.state = {
          ...this.state,
          flowFeedback: null,
          assistantRailChat: {
            ...this.state.assistantRailChat,
            selectedGroupJid: value || null,
          },
        };
        this.render();
        return;
      case 'railChat.contextMode': {
        const nextContextMode = value === 'group' ? 'group' : 'global';
        this.state = {
          ...this.state,
          flowFeedback: null,
          assistantRailChat: {
            ...this.state.assistantRailChat,
            contextMode: nextContextMode,
            selectedGroupJid:
              nextContextMode === 'group'
                ? resolveAssistantRailSelectedGroupJid(
                    this.state.assistantRailChat.selectedGroupJid,
                    this.state.assistantRailChat.availableGroups,
                    this.getAssistantRailPreferredGroupJid(),
                  )
                : this.state.assistantRailChat.selectedGroupJid,
          },
        };
        this.render();
        return;
      }
      case 'group.documentId':
      case 'group.filePath':
      case 'group.title':
      case 'group.summary':
      case 'group.aliases':
      case 'group.tags':
      case 'group.enabled':
      case 'group.content':
        this.state = {
          ...this.state,
          flowFeedback: null,
          groupManagementDraft: {
            ...this.state.groupManagementDraft,
            knowledgeDocument: {
              ...this.state.groupManagementDraft.knowledgeDocument,
              [fieldKey.replace('group.', '')]: value,
            } as GroupKnowledgeDraft,
          },
        };
        this.render();
        return;
      default:
        return;
    }
  }

  private async handleFlowAction(
    action: string,
    value?: string,
    options: {
      readonly confirmed?: boolean;
    } = {},
  ): Promise<void> {
    if (action === 'schedule-save') {
      const page = this.readWeekPageData();

      if (!page) {
        return;
      }

      const draft = resolveScheduleDraft(this.state.scheduleDraft, page.data.groups);

      if (!draft.groupJid || !draft.title.trim()) {
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'warning',
            message: 'Falta escolher um grupo e dar um titulo claro antes de gravar.',
          },
        };
        this.render();
        return;
      }

      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: 'A gravar este agendamento no backend real para atualizares logo a agenda da semana.',
        },
      };
      this.render();

      try {
        const saved = await this.currentClient().saveWeeklySchedule({
          eventId: draft.eventId ?? undefined,
          groupJid: draft.groupJid,
          title: draft.title,
          dayLabel: draft.dayLabel,
          startTime: draft.startTime,
          durationMinutes: Number.parseInt(draft.durationMinutes, 10),
          notes: draft.notes,
          timeZone: page.data.timezone,
        });
        this.state = {
          ...this.state,
          scheduleDraft: mapScheduleEventToDraft(saved),
          flowFeedback: {
            tone: 'positive',
            message: draft.eventId
              ? `Agendamento ${saved.title} atualizado na semana ${saved.weekId}.`
              : `Agendamento ${saved.title} criado na semana ${saved.weekId}.`,
          },
        };
        this.recordUxEvent('positive', `Agendamento ${saved.title} gravado em live.`);
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel gravar o agendamento. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action === 'schedule-clear') {
      this.state = {
        ...this.state,
        scheduleDraft: createEmptyScheduleDraft(),
        flowFeedback: {
          tone: 'neutral',
          message: 'Formulario de agendamento limpo. Podes testar o fluxo outra vez.',
        },
      };
      this.recordUxEvent('neutral', 'Formulario de agendamento limpo.');
      this.render();
      return;
    }

    if (action === 'schedule-compose-day') {
      const page = this.readWeekPageData();

      if (!page || !value) {
        return;
      }

      const nextDraft = resolveScheduleDraft(
        {
          ...this.state.scheduleDraft,
          eventId: null,
          dayLabel: value,
        },
        page.data.groups,
      );

      this.state = {
        ...this.state,
        scheduleDraft: nextDraft,
        flowFeedback: {
          tone: 'positive',
          message: `Editor preparado para ${readableWeekDayLabel(nextDraft.dayLabel)}. Agora so falta ajustar os detalhes.`,
        },
      };
      this.recordUxEvent('positive', `Editor semanal aberto em ${readableWeekDayLabel(nextDraft.dayLabel)}.`);
      this.render();
      return;
    }

    if (action === 'schedule-load-example') {
      const page = this.readWeekPageData();

      if (!page || !value) {
        return;
      }

      const group = page.data.groups.find((candidate) => candidate.groupJid === value);

      if (!group) {
        return;
      }

      const example = buildScheduleExample(group, 0);
      this.state = {
        ...this.state,
        scheduleDraft: {
          eventId: null,
          groupJid: group.groupJid,
          title: example.title,
          dayLabel: example.dayLabel,
          startTime: example.startTime,
          durationMinutes: example.durationMinutes,
          notes: example.notes,
        },
        flowFeedback: {
          tone: 'positive',
          message: `Preenchemos o fluxo com um exemplo base para ${group.preferredSubject}.`,
        },
      };
      this.recordUxEvent('positive', `Exemplo carregado para ${group.preferredSubject}.`);
      this.render();
      return;
    }

    if (action === 'schedule-load-event') {
      const page = this.readWeekPageData();

      if (!page || !value) {
        return;
      }

      const event = page.data.events.find((candidate) => candidate.eventId === value);

      if (!event) {
        return;
      }

      this.state = {
        ...this.state,
        scheduleDraft: mapScheduleEventToDraft(event),
        flowFeedback: {
          tone: 'positive',
          message: `Carregamos ${event.title} no formulario para o editares em contexto.`,
        },
      };
      this.recordUxEvent('positive', `Evento ${event.title} carregado para edicao.`);
      this.render();
      return;
    }

    if (action === 'schedule-delete') {
      const page = this.readWeekPageData();

      if (!page || !value) {
        return;
      }

      const event = page.data.events.find((candidate) => candidate.eventId === value);

      if (!event) {
        return;
      }

      if (!options.confirmed) {
        this.state = {
          ...this.state,
          pendingConfirmation: {
            domain: 'flow',
            key: `schedule-delete:${event.eventId}`,
            action,
            dataset: {
              flowValue: event.eventId,
            },
            title: `Desativar ${event.title}?`,
            description:
              'Isto remove o agendamento real desta semana e apaga a projection ativa desta notificacao. Vale a pena confirmar antes de continuar.',
            confirmLabel: 'Desativar agora',
            tone: 'danger',
          },
          flowFeedback: {
            tone: 'warning',
            message: `Confirmacao pedida antes de desativar ${event.title}.`,
          },
        };
        this.recordUxEvent('warning', `Confirmacao pedida para desativar ${event.title}.`);
        this.render();
        return;
      }

      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: `A desativar ${event.title} da semana ${event.weekId}.`,
        },
      };
      this.render();

      try {
        const result = await this.currentClient().deleteWeeklySchedule(event.eventId, event.groupJid);
        this.state = {
          ...this.state,
          scheduleDraft:
            this.state.scheduleDraft.eventId === event.eventId ? createEmptyScheduleDraft() : this.state.scheduleDraft,
          flowFeedback: {
            tone: result.deleted ? 'positive' : 'warning',
            message: result.deleted
              ? `Agendamento ${event.title} desativado da semana ${event.weekId}.`
              : `O agendamento ${event.title} ja nao existia quando tentaste desativar.`,
          },
        };
        this.recordUxEvent('positive', `Agendamento ${event.title} desativado.`);
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel desativar o agendamento. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action === 'media-select-asset' && value) {
      const page = this.readMediaPageData();
      const asset = page?.data.assets.find((candidate) => candidate.assetId === value) ?? null;

      this.state = {
        ...this.state,
        flowFeedback: asset
          ? {
              tone: 'positive',
              message: `${readableMediaType(asset.mediaType)} carregado no fluxo guiado para distribuicao.`,
            }
          : null,
        mediaDistributionDraft: {
          ...this.state.mediaDistributionDraft,
          assetId: value,
          caption: asset?.caption ?? '',
        },
      };
      this.render();
      return;
    }

    if (action === 'media-toggle-group' && value) {
      const page = this.readMediaPageData();

      if (!page || !page.data.groups.some((group) => group.groupJid === value)) {
        return;
      }

      const nextTargetGroupJids = this.state.mediaDistributionDraft.targetGroupJids.includes(value)
        ? this.state.mediaDistributionDraft.targetGroupJids.filter((groupJid) => groupJid !== value)
        : dedupeStringList([...this.state.mediaDistributionDraft.targetGroupJids, value]);

      this.state = {
        ...this.state,
        flowFeedback: null,
        mediaDistributionDraft: {
          ...this.state.mediaDistributionDraft,
          targetGroupJids: nextTargetGroupJids,
        },
      };
      this.render();
      return;
    }

    if (action === 'media-toggle-all-groups') {
      const page = this.readMediaPageData();

      if (!page) {
        return;
      }

      const allGroupJids = page.data.groups.map((group) => group.groupJid);
      const allSelected =
        allGroupJids.length > 0 &&
        allGroupJids.every((groupJid) => this.state.mediaDistributionDraft.targetGroupJids.includes(groupJid));

      this.state = {
        ...this.state,
        flowFeedback: null,
        mediaDistributionDraft: {
          ...this.state.mediaDistributionDraft,
          targetGroupJids: allSelected ? [] : allGroupJids,
        },
      };
      this.render();
      return;
    }

    if (action === 'media-clear') {
      const page = this.readMediaPageData();
      this.state = {
        ...this.state,
        mediaDistributionDraft: page
          ? resolveMediaDistributionDraft(createEmptyMediaDistributionDraft(), page.data.assets, page.data.groups)
          : createEmptyMediaDistributionDraft(),
        flowFeedback: {
          tone: 'neutral',
          message: 'Fluxo de video limpo. Podes escolher outro asset e outro conjunto de grupos.',
        },
      };
      this.recordUxEvent('neutral', 'Fluxo de distribuicao de video limpo.');
      this.render();
      return;
    }

    if (action === 'media-distribute-dry-run' || action === 'media-distribute-confirmed') {
      const page = this.readMediaPageData();

      if (!page) {
        return;
      }

      const draft = resolveMediaDistributionDraft(this.state.mediaDistributionDraft, page.data.assets, page.data.groups);
      const asset = page.data.assets.find((candidate) => candidate.assetId === draft.assetId) ?? null;

      if (!asset) {
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'warning',
            message: 'Escolhe primeiro o video recebido antes de tentares distribuir.',
          },
        };
        this.render();
        return;
      }

      if (draft.targetGroupJids.length === 0) {
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'warning',
            message: 'Escolhe pelo menos um grupo antes de criar o dry run ou o envio real.',
          },
        };
        this.render();
        return;
      }

      const mode = action === 'media-distribute-confirmed' ? 'confirmed' : 'dry_run';
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message:
            mode === 'confirmed'
              ? 'A criar um envio real deste video para os grupos escolhidos.'
              : 'A criar um dry run deste video para rever a distribuicao.',
        },
      };
      this.render();

      try {
        const result = await this.currentClient().createDistribution({
          sourceMessageId: `manual-media-${Date.now()}`,
          assetId: asset.assetId,
          caption: draft.caption,
          targetGroupJids: draft.targetGroupJids,
          mode,
        });
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'positive',
            message:
              result.instruction.mode === 'confirmed'
                ? `Video colocado em distribuicao real para ${result.plan.targetCount} grupos.`
                : `Dry run deste video criado para ${result.plan.targetCount} grupos.`,
          },
        };
        this.recordUxEvent('positive', `Distribuicao de video ${result.instruction.instructionId} criada.`);
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel criar a distribuicao de video. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action === 'distribution-save') {
      const page = this.readRoutingPageData();

      if (!page) {
        return;
      }

      const draft = resolveDistributionDraft(this.state.distributionDraft, page.data.rules);
      const selectedRule = page.data.rules.find((rule) => rule.ruleId === draft.ruleId) ?? null;

      if (!selectedRule || !draft.messageSummary.trim()) {
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'warning',
            message: 'Escolhe uma regra e escreve a mensagem antes de preparar a distribuicao.',
          },
        };
        this.render();
        return;
      }

      const mode = resolveDistributionExecutionMode(draft.confirmationMode, selectedRule.requiresConfirmation);
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message:
            mode === 'dry_run'
              ? 'A criar um preview real de distribuicao para poderes rever os alvos.'
              : 'A criar uma distribuicao real na fila operacional.',
        },
      };
      this.render();

      try {
        const result = await this.currentClient().createDistribution({
          sourceMessageId: `manual-${Date.now()}`,
          personId: selectedRule.personId ?? undefined,
          identifiers: selectedRule.identifiers,
          messageText: draft.messageSummary,
          mode,
        });
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'positive',
            message:
              result.instruction.mode === 'dry_run'
                ? `Preview real criado para ${result.plan.targetCount} grupos alvo.`
                : `Distribuicao real criada para ${result.plan.targetCount} grupos alvo.`,
          },
        };
        this.recordUxEvent('positive', `Distribuicao ${result.instruction.instructionId} criada.`);
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel criar a distribuicao. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action === 'distribution-clear') {
      this.state = {
        ...this.state,
        distributionDraft: {
          ruleId: '',
          messageSummary: '',
          urgency: 'normal',
          confirmationMode: 'rule_default',
        },
        flowFeedback: {
          tone: 'neutral',
          message: 'Fluxo de distribuicao limpo para um novo teste.',
        },
      };
      this.recordUxEvent('neutral', 'Fluxo de distribuicao limpo.');
      this.render();
      return;
    }

    if (action === 'repair-focus' && (value === 'auth' || value === 'groups' || value === 'permissions')) {
      this.state = {
        ...this.state,
        whatsappRepairFocus: value,
        flowFeedback: null,
      };
      this.recordUxEvent('neutral', `Foco da reparacao WhatsApp mudado para ${value}.`);
      this.render();
      return;
    }

    if (action === 'watchdog-dismiss' && value) {
      if (this.state.dismissedWatchdogIssueIds.includes(value)) {
        return;
      }

      this.state = {
        ...this.state,
        dismissedWatchdogIssueIds: [...this.state.dismissedWatchdogIssueIds, value],
        flowFeedback: {
          tone: 'positive',
          message: 'Issue marcada como revista nesta sessao. A fila ficou mais clara para continuares.',
        },
      };
      this.recordUxEvent('positive', `Issue ${value} marcada como revista.`);
      this.render();
    }
  }

  private readWeekPageData(): UiPage<WeekPlannerSnapshot> | null {
    const page = this.state.page as UiPage<WeekPlannerSnapshot> | null;

    if (!page || page.route !== '/week') {
      return null;
    }

    return page;
  }

  private readRoutingPageData(): UiPage<RoutingConsoleSnapshot> | null {
    const page = this.state.page as UiPage<RoutingConsoleSnapshot> | null;

    if (!page || page.route !== '/distributions') {
      return null;
    }

    return page;
  }

  private readAssistantPageData(): UiPage<AssistantPageData> | null {
    const page = this.state.page as UiPage<AssistantPageData> | null;

    if (!page || page.route !== '/assistant') {
      return null;
    }

    return page;
  }

  private readMediaPageData(): UiPage<MediaLibraryPageData> | null {
    const page = this.state.page as UiPage<MediaLibraryPageData> | null;

    if (!page || page.route !== '/media') {
      return null;
    }

    return page;
  }

  private readWorkspacePageData(): UiPage<WorkspaceAgentPageData> | null {
    const page = this.state.page as UiPage<WorkspaceAgentPageData> | null;

    if (!page || page.route !== '/workspace') {
      return null;
    }

    return page;
  }

  private readGroupManagementPageData(): UiPage<GroupManagementPageData> | null {
    const page = this.state.page as UiPage<GroupManagementPageData> | null;

    if (!page || page.route !== '/groups') {
      return null;
    }

    return page;
  }

  private readSettingsPageData(): UiPage<SettingsPageData> | null {
    const page = this.state.page as UiPage<SettingsPageData> | null;

    if (!page || page.route !== '/settings') {
      return null;
    }

    return page;
  }

  private readSettingsSurfacePage(): UiPage<SettingsPageData | MigrationPageData> | null {
    const page = this.state.page as UiPage<SettingsPageData | MigrationPageData> | null;

    if (!page || (page.route !== '/settings' && page.route !== '/migration')) {
      return null;
    }

    return page;
  }

  private readWhatsAppPageData(): WhatsAppManagementPageData | null {
    const page = this.state.page as UiPage<WhatsAppManagementPageData> | null;

    if (!page || page.route !== '/whatsapp') {
      return null;
    }

    return page.data;
  }

  private async loadWorkspacePreview(relativePath: string): Promise<void> {
    this.state = {
      ...this.state,
      workspaceAgentDraft: {
        ...this.state.workspaceAgentDraft,
        previewPath: relativePath,
        loadingPreview: true,
      },
      flowFeedback: null,
    };
    this.render();

    try {
      const preview = await this.currentClient().getWorkspaceFile(relativePath);
      this.state = {
        ...this.state,
        workspaceAgentDraft: {
          ...this.state.workspaceAgentDraft,
          previewPath: relativePath,
          previewContent: preview,
          loadingPreview: false,
        },
      };
      this.render();
    } catch (error) {
      const message = `Nao foi possivel ler este ficheiro do LumeHub. ${readErrorMessage(error)}`;
      this.state = {
        ...this.state,
        workspaceAgentDraft: {
          ...this.state.workspaceAgentDraft,
          loadingPreview: false,
        },
        flowFeedback: {
          tone: 'danger',
          message,
        },
      };
      this.recordUxEvent('danger', summarizeTelemetryMessage(message));
      this.render();
    }
  }

  private buildWorkspaceConfirmation(
    action: string,
    draft: WorkspaceAgentDraft,
  ): PendingConfirmation | null {
    if (action !== 'run-agent' || draft.mode !== 'apply') {
      return null;
    }

    const selectedFilesLabel =
      draft.selectedFilePaths.length > 0
        ? `${draft.selectedFilePaths.length} ficheiro(s) em foco`
        : 'sem ficheiros em foco';

    return {
      domain: 'workspace',
      key: `workspace-run:${draft.mode}:${draft.selectedFilePaths.join('|')}:${draft.prompt.trim()}`,
      action,
      dataset: {},
      title: 'Aplicar alteracoes no projeto?',
      description: `A LLM vai poder editar ficheiros do LumeHub a partir deste pedido, com ${selectedFilesLabel}. Confirma so quando a instrução estiver pronta para mexer no repo.`,
      confirmLabel: 'Aplicar agora',
      tone: 'warning',
    };
  }

  private async handleWorkspaceAction(
    action: string,
    dataset: ActionDataset,
    options: {
      readonly confirmed?: boolean;
    } = {},
  ): Promise<void> {
    const page = this.readWorkspacePageData();

    if (!page) {
      return;
    }

    if (action === 'search-files') {
      this.state = {
        ...this.state,
        workspaceAgentDraft: {
          ...this.state.workspaceAgentDraft,
          searching: true,
        },
        flowFeedback: {
          tone: 'neutral',
          message: 'A procurar ficheiros no repo do LumeHub.',
        },
      };
      this.render();

      try {
        const results = await this.currentClient().searchWorkspaceFiles(this.state.workspaceAgentDraft.query, 80);
        this.state = {
          ...this.state,
          workspaceAgentDraft: {
            ...this.state.workspaceAgentDraft,
            searching: false,
            searchResults: results,
          },
          flowFeedback: {
            tone: results.length > 0 ? 'positive' : 'warning',
            message:
              results.length > 0
                ? `${results.length} ficheiro(s) encontrado(s) para esta pesquisa.`
                : 'Esta pesquisa nao devolveu ficheiros. Experimenta outra palavra.',
          },
        };
        this.render();
      } catch (error) {
        const message = `Nao foi possivel listar os ficheiros do projeto. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          workspaceAgentDraft: {
            ...this.state.workspaceAgentDraft,
            searching: false,
          },
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action === 'toggle-file-selection') {
      const relativePath = dataset.workspaceFilePath;

      if (!relativePath) {
        return;
      }

      this.state = {
        ...this.state,
        workspaceAgentDraft: {
          ...this.state.workspaceAgentDraft,
          selectedFilePaths: this.state.workspaceAgentDraft.selectedFilePaths.includes(relativePath)
            ? this.state.workspaceAgentDraft.selectedFilePaths.filter((filePath) => filePath !== relativePath)
            : dedupeStringList([...this.state.workspaceAgentDraft.selectedFilePaths, relativePath]),
        },
        flowFeedback: null,
      };
      this.render();
      return;
    }

    if (action === 'preview-file') {
      const relativePath = dataset.workspaceFilePath;

      if (!relativePath) {
        return;
      }

      await this.loadWorkspacePreview(relativePath);
      return;
    }

    if (action === 'review-file') {
      const relativePath = dataset.workspaceFilePath ?? this.state.workspaceAgentDraft.previewContent?.relativePath;

      if (!relativePath) {
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'warning',
            message: 'Escolhe primeiro um ficheiro para preparar uma revisao sem alteracoes.',
          },
        };
        this.render();
        return;
      }

      if (this.state.workspaceAgentDraft.previewPath !== relativePath) {
        await this.loadWorkspacePreview(relativePath);
      }

      this.state = {
        ...this.state,
        workspaceAgentDraft: {
          ...this.state.workspaceAgentDraft,
          mode: 'plan',
          prompt: buildWorkspaceReviewPrompt(relativePath),
          selectedFilePaths: [relativePath],
        },
        flowFeedback: {
          tone: 'positive',
          message: `Prompt preparado para rever ${relativePath} sem alterar ficheiros.`,
        },
      };
      this.render();
      return;
    }

    if (action === 'clear-selection') {
      this.state = {
        ...this.state,
        workspaceAgentDraft: createEmptyWorkspaceAgentDraft(),
        flowFeedback: {
          tone: 'neutral',
          message: 'Fluxo do agente de projeto limpo para um novo pedido.',
        },
      };
      this.recordUxEvent('neutral', 'Fluxo do agente de projeto limpo.');
      this.render();
      return;
    }

    if (action === 'run-agent') {
      const prompt = this.state.workspaceAgentDraft.prompt.trim();

      if (!prompt) {
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'warning',
            message: 'Escreve primeiro o pedido que queres fazer ao agente do projeto.',
          },
        };
        this.render();
        return;
      }

      const pendingConfirmation = !options.confirmed
        ? this.buildWorkspaceConfirmation(action, this.state.workspaceAgentDraft)
        : null;

      if (pendingConfirmation) {
        this.state = {
          ...this.state,
          pendingConfirmation,
          flowFeedback: {
            tone: 'warning',
            message: pendingConfirmation.description,
          },
        };
        this.recordUxEvent('warning', `Confirmacao pedida: ${pendingConfirmation.title}`);
        this.render();
        return;
      }

      this.state = {
        ...this.state,
        workspaceAgentDraft: {
          ...this.state.workspaceAgentDraft,
          running: true,
        },
        flowFeedback: {
          tone: 'neutral',
          message:
            this.state.workspaceAgentDraft.mode === 'plan'
              ? 'A pedir ao agente um plano sobre o repo do LumeHub.'
              : 'A correr o agente com permissao para alterar ficheiros do LumeHub.',
        },
      };
      this.render();

      try {
        const run = await this.currentClient().runWorkspaceAgent({
          prompt,
          mode: this.state.workspaceAgentDraft.mode,
          filePaths: this.state.workspaceAgentDraft.selectedFilePaths,
          confirmedApply: this.state.workspaceAgentDraft.mode === 'apply' ? options.confirmed === true : undefined,
          requestedBy: 'workspace-ui',
        });
        await this.refreshCurrentRouteData();

        const previewTarget = run.changedFiles[0] ?? run.structuredSummary.readFiles[0];

        if (previewTarget) {
          await this.loadWorkspacePreview(previewTarget);
        }

        this.state = {
          ...this.state,
          workspaceAgentDraft: {
            ...this.state.workspaceAgentDraft,
            running: false,
          },
          flowFeedback: {
            tone:
              run.executionState === 'rejected'
                ? 'warning'
                : run.status === 'completed'
                  ? 'positive'
                  : 'warning',
            message:
              run.executionState === 'rejected'
                ? `Run bloqueada por guardrail. ${run.guardrailReason ?? run.outputSummary}`
                : run.status === 'completed'
                ? run.changedFiles.length > 0
                  ? `Run concluida. ${run.structuredSummary.summary} Diff disponivel para ${run.changedFiles.length} ficheiro(s).`
                  : `Run concluida sem alterar ficheiros. ${run.structuredSummary.summary}`
                : `Run terminou com erro. ${run.outputSummary}`,
          },
        };
        this.recordUxEvent(
          run.executionState === 'rejected' ? 'warning' : run.status === 'completed' ? 'positive' : 'warning',
          run.executionState === 'rejected'
            ? `Run ${run.runId} rejeitada por guardrail no workspace agent.`
            : `Run ${run.runId} concluida no workspace agent.`,
        );
        this.render();
      } catch (error) {
        const message = `Nao foi possivel correr o agente do projeto. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          workspaceAgentDraft: {
            ...this.state.workspaceAgentDraft,
            running: false,
          },
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
    }
  }

  private buildAssistantScheduleConfirmation(preview: AssistantSchedulePreviewSnapshot): PendingConfirmation | null {
    if (!preview.previewFingerprint || !preview.canApply) {
      return null;
    }

    return {
      domain: 'assistant',
      key: `assistant-schedule:${preview.previewFingerprint}`,
      action: 'apply-schedule',
      dataset: {
        assistantPreviewFingerprint: preview.previewFingerprint,
      },
      title: 'Aplicar alteracao na agenda?',
      description: `${preview.summary} Esta acao vai mexer no calendario real do grupo ${
        preview.groupLabel ?? preview.groupJid ?? 'selecionado'
      }.`,
      confirmLabel: 'Aplicar agora',
      tone: 'warning',
    };
  }

  private async handleAssistantAction(
    action: string,
    dataset: ActionDataset,
    options: {
      readonly confirmed?: boolean;
    } = {},
  ): Promise<void> {
    const page = this.readAssistantPageData();

    if (!page) {
      return;
    }

    if (action === 'clear-schedule') {
      this.state = {
        ...this.state,
        assistantSchedulingDraft: resolveAssistantSchedulingDraft(createEmptyAssistantSchedulingDraft(), page.data.groups),
        flowFeedback: {
          tone: 'neutral',
          message: 'Pedido do assistente limpo para criares um preview novo.',
        },
      };
      this.render();
      return;
    }

    const draft = resolveAssistantSchedulingDraft(this.state.assistantSchedulingDraft, page.data.groups);

    if (!draft.groupJid || !draft.text.trim()) {
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'warning',
          message: 'Escolhe um grupo e escreve o pedido antes de continuares.',
        },
      };
      this.render();
      return;
    }

    if (action === 'preview-schedule') {
      this.state = {
        ...this.state,
        assistantSchedulingDraft: {
          ...this.state.assistantSchedulingDraft,
          previewLoading: true,
          lastApplied: null,
        },
        flowFeedback: {
          tone: 'neutral',
          message: 'A pedir ao assistente um preview da alteracao na agenda.',
        },
      };
      this.render();

      try {
        const preview = await this.currentClient().previewAssistantSchedule({
          text: draft.text.trim(),
          groupJid: draft.groupJid,
          requestedAccessMode: 'read_write',
        });
        this.state = {
          ...this.state,
          assistantSchedulingDraft: {
            ...this.state.assistantSchedulingDraft,
            previewLoading: false,
            preview,
            lastApplied: null,
          },
          flowFeedback: {
            tone: preview.canApply ? 'positive' : 'warning',
            message: preview.canApply
              ? 'Preview pronto. Confirma o diff e aplica quando estiveres satisfeito.'
              : preview.blockingReason ?? 'O preview ficou bloqueado e precisa de ajuste.',
          },
        };
        this.recordUxEvent(preview.canApply ? 'positive' : 'warning', `Preview de scheduling gerado para ${preview.groupLabel ?? preview.groupJid ?? 'grupo'}.`);
        this.render();
      } catch (error) {
        const message = `Nao foi possivel gerar o preview do scheduling. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          assistantSchedulingDraft: {
            ...this.state.assistantSchedulingDraft,
            previewLoading: false,
          },
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action !== 'apply-schedule') {
      return;
    }

    const previewFingerprint =
      dataset.assistantPreviewFingerprint ?? this.state.assistantSchedulingDraft.preview?.previewFingerprint ?? null;
    const preview = this.state.assistantSchedulingDraft.preview;

    if (!preview || !previewFingerprint || preview.previewFingerprint !== previewFingerprint) {
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'warning',
          message: 'Atualiza primeiro o preview antes de aplicares a alteracao real.',
        },
      };
      this.render();
      return;
    }

    const pendingConfirmation = !options.confirmed
      ? this.buildAssistantScheduleConfirmation(preview)
      : null;

    if (pendingConfirmation) {
      this.state = {
        ...this.state,
        pendingConfirmation,
        flowFeedback: {
          tone: 'warning',
          message: pendingConfirmation.description,
        },
      };
      this.recordUxEvent('warning', `Confirmacao pedida: ${pendingConfirmation.title}`);
      this.render();
      return;
    }

    this.state = {
      ...this.state,
      assistantSchedulingDraft: {
        ...this.state.assistantSchedulingDraft,
        applying: true,
      },
      flowFeedback: {
        tone: 'neutral',
        message: 'A aplicar a alteracao no calendario real e a guardar auditoria.',
      },
    };
    this.render();

    try {
      const result = await this.currentClient().applyAssistantSchedule({
        text: draft.text.trim(),
        groupJid: draft.groupJid,
        previewFingerprint,
        requestedAccessMode: 'read_write',
      });

      this.state = {
        ...this.state,
        assistantSchedulingDraft: {
          ...this.state.assistantSchedulingDraft,
          applying: false,
          preview: result.preview,
          lastApplied: result,
        },
        flowFeedback: {
          tone: result.appliedInstruction?.status === 'completed' ? 'positive' : 'warning',
          message:
            result.appliedEvent
              ? `${result.appliedEvent.title} ja foi refletido na agenda real.`
              : `Pedido colocado na fila com estado ${result.appliedInstruction?.status ?? result.instruction.status}.`,
        },
      };
      this.recordUxEvent('positive', `Alteracao de scheduling aplicada para ${result.preview.groupLabel ?? result.preview.groupJid ?? 'grupo'}.`);
      await this.refreshCurrentRouteData();
    } catch (error) {
      const message = `Nao foi possivel aplicar esta alteracao na agenda. ${readErrorMessage(error)}`;
      this.state = {
        ...this.state,
        assistantSchedulingDraft: {
          ...this.state.assistantSchedulingDraft,
          applying: false,
        },
        flowFeedback: {
          tone: 'danger',
          message,
        },
      };
      this.recordUxEvent('danger', summarizeTelemetryMessage(message));
      this.render();
    }
  }

  private async handleSettingsAction(
    action: string,
    dataset: ActionDataset,
    options: {
      readonly confirmed?: boolean;
    } = {},
  ): Promise<void> {
    const page = this.readSettingsSurfacePage();

    if (!page) {
      return;
    }

    if (action === 'refresh-migration') {
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: 'A atualizar o snapshot de shadow mode e o estado do Codex auto router.',
        },
      };
      this.render();
      await this.refreshCurrentRouteData();
      return;
    }

    if (action === 'prepare-codex-router') {
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: 'A preparar a melhor conta disponivel no Codex auto router.',
        },
      };
      this.render();

      try {
        const status = await this.currentClient().prepareCodexAuthRouter();
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'positive',
            message: `Router preparado com ${status.currentSelection?.label ?? 'uma conta disponivel'}.`,
          },
        };
        this.recordUxEvent('positive', `Codex auto router preparado com ${status.currentSelection?.accountId ?? 'sem conta'}.`);
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel preparar o Codex auto router. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action === 'switch-codex-account') {
      const accountId = dataset.codexAccountId;

      if (!accountId) {
        return;
      }

      if (!options.confirmed) {
        this.state = {
          ...this.state,
          pendingConfirmation: {
            domain: 'settings',
            key: `codex-router-switch:${accountId}`,
            action,
            dataset: {
              codexAccountId: accountId,
            },
            title: 'Trocar a conta ativa do Codex?',
            description: 'Isto vai reescrever a auth canónica atual do Codex para a conta escolhida.',
            confirmLabel: 'Trocar conta',
            tone: 'warning',
          },
          flowFeedback: {
            tone: 'warning',
            message: 'Confirma primeiro a troca manual da conta ativa do Codex.',
          },
        };
        this.render();
        return;
      }

      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: 'A trocar a conta ativa do Codex neste runtime.',
        },
      };
      this.render();

      try {
        const status = await this.currentClient().forceCodexAuthSwitch(accountId);
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'positive',
            message: `Conta ativa trocada para ${status.currentSelection?.label ?? accountId}.`,
          },
        };
        this.recordUxEvent('positive', `Codex auto router trocado para ${accountId}.`);
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel trocar a conta do Codex. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action === 'clear-legacy-import-report') {
      this.state = {
        ...this.state,
        legacyScheduleMigrationDraft: {
          ...this.state.legacyScheduleMigrationDraft,
          report: null,
        },
        flowFeedback: {
          tone: 'neutral',
          message: 'Relatorio da migracao legacy limpo desta sessao.',
        },
      };
      this.render();
      return;
    }

    if (action === 'clear-alerts-import-report') {
      this.state = {
        ...this.state,
        legacyAlertMigrationDraft: {
          ...this.state.legacyAlertMigrationDraft,
          report: null,
        },
        flowFeedback: {
          tone: 'neutral',
          message: 'Relatorio da migracao de alerts limpo desta sessao.',
        },
      };
      this.render();
      return;
    }

    if (action === 'clear-automations-import-report') {
      this.state = {
        ...this.state,
        legacyAutomationMigrationDraft: {
          ...this.state.legacyAutomationMigrationDraft,
          report: null,
        },
        flowFeedback: {
          tone: 'neutral',
          message: 'Relatorio da migracao de automations limpo desta sessao.',
        },
      };
      this.render();
      return;
    }

    if (action === 'preview-alerts-import') {
      this.state = {
        ...this.state,
        legacyAlertMigrationDraft: {
          ...this.state.legacyAlertMigrationDraft,
          previewLoading: true,
          applying: false,
        },
        flowFeedback: {
          tone: 'neutral',
          message: 'A gerar preview da migracao de alerts do WA-notify.',
        },
      };
      this.render();

      try {
        const report = await this.currentClient().previewLegacyAlertsImport();
        this.state = {
          ...this.state,
          legacyAlertMigrationDraft: {
            ...this.state.legacyAlertMigrationDraft,
            previewLoading: false,
            applying: false,
            report,
          },
          flowFeedback: {
            tone: 'positive',
            message: `Preview de alerts pronto com ${report.totals.importedRules} regra(s).`,
          },
        };
        this.recordUxEvent('positive', `Preview de alerts gerado com ${report.totals.importedRules} regra(s).`);
        this.render();
      } catch (error) {
        const message = `Nao foi possivel gerar o preview dos alerts. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          legacyAlertMigrationDraft: {
            ...this.state.legacyAlertMigrationDraft,
            previewLoading: false,
          },
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action === 'apply-alerts-import') {
      if (!options.confirmed) {
        this.state = {
          ...this.state,
          pendingConfirmation: {
            domain: 'settings',
            key: 'alerts-import',
            action,
            dataset: {},
            title: 'Importar alerts legacy?',
            description: 'Isto substitui a lista atual de regras de alerts pela migracao vinda do WA-notify.',
            confirmLabel: 'Importar alerts',
            tone: 'warning',
          },
          flowFeedback: {
            tone: 'warning',
            message: 'Confirma primeiro a importacao real dos alerts legacy.',
          },
        };
        this.render();
        return;
      }

      this.state = {
        ...this.state,
        legacyAlertMigrationDraft: {
          ...this.state.legacyAlertMigrationDraft,
          previewLoading: false,
          applying: true,
        },
        flowFeedback: {
          tone: 'neutral',
          message: 'A importar alerts legacy para a configuracao real.',
        },
      };
      this.render();

      try {
        const report = await this.currentClient().applyLegacyAlertsImport();
        this.state = {
          ...this.state,
          legacyAlertMigrationDraft: {
            ...this.state.legacyAlertMigrationDraft,
            previewLoading: false,
            applying: false,
            report,
          },
          flowFeedback: {
            tone: 'positive',
            message: `Import de alerts aplicado com ${report.totals.importedRules} regra(s).`,
          },
        };
        this.recordUxEvent('positive', `Import de alerts aplicado com ${report.totals.importedRules} regra(s).`);
        this.render();
        void this.refreshCurrentRouteData({ silent: true });
      } catch (error) {
        const message = `Nao foi possivel aplicar o import dos alerts. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          legacyAlertMigrationDraft: {
            ...this.state.legacyAlertMigrationDraft,
            applying: false,
            previewLoading: false,
          },
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action === 'preview-automations-import') {
      this.state = {
        ...this.state,
        legacyAutomationMigrationDraft: {
          ...this.state.legacyAutomationMigrationDraft,
          previewLoading: true,
          applying: false,
        },
        flowFeedback: {
          tone: 'neutral',
          message: 'A gerar preview da migracao de automations do WA-notify.',
        },
      };
      this.render();

      try {
        const report = await this.currentClient().previewLegacyAutomationsImport();
        this.state = {
          ...this.state,
          legacyAutomationMigrationDraft: {
            ...this.state.legacyAutomationMigrationDraft,
            previewLoading: false,
            applying: false,
            report,
          },
          flowFeedback: {
            tone: report.totals.missingGroups > 0 ? 'warning' : 'positive',
            message:
              report.totals.missingGroups > 0
                ? `Preview pronto com ${report.totals.importedDefinitions} automations e ${report.totals.missingGroups} grupo(s) em falta.`
                : `Preview pronto com ${report.totals.importedDefinitions} automations.`,
          },
        };
        this.recordUxEvent('positive', `Preview de automations gerado com ${report.totals.importedDefinitions} item(ns).`);
        this.render();
      } catch (error) {
        const message = `Nao foi possivel gerar o preview das automations. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          legacyAutomationMigrationDraft: {
            ...this.state.legacyAutomationMigrationDraft,
            previewLoading: false,
          },
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action === 'apply-automations-import') {
      if (!options.confirmed) {
        this.state = {
          ...this.state,
          pendingConfirmation: {
            domain: 'settings',
            key: 'automations-import',
            action,
            dataset: {},
            title: 'Importar automations legacy?',
            description: 'Isto substitui a lista atual de automations pela migracao vinda do WA-notify.',
            confirmLabel: 'Importar automations',
            tone: 'warning',
          },
          flowFeedback: {
            tone: 'warning',
            message: 'Confirma primeiro a importacao real das automations legacy.',
          },
        };
        this.render();
        return;
      }

      this.state = {
        ...this.state,
        legacyAutomationMigrationDraft: {
          ...this.state.legacyAutomationMigrationDraft,
          previewLoading: false,
          applying: true,
        },
        flowFeedback: {
          tone: 'neutral',
          message: 'A importar automations legacy para a configuracao real.',
        },
      };
      this.render();

      try {
        const report = await this.currentClient().applyLegacyAutomationsImport();
        this.state = {
          ...this.state,
          legacyAutomationMigrationDraft: {
            ...this.state.legacyAutomationMigrationDraft,
            previewLoading: false,
            applying: false,
            report,
          },
          flowFeedback: {
            tone: report.totals.missingGroups > 0 ? 'warning' : 'positive',
            message:
              report.totals.missingGroups > 0
                ? `Import aplicado com ${report.totals.importedDefinitions} automations e ${report.totals.missingGroups} grupo(s) em falta para rever.`
                : `Import de automations aplicado com ${report.totals.importedDefinitions} item(ns).`,
          },
        };
        this.recordUxEvent('positive', `Import de automations aplicado com ${report.totals.importedDefinitions} item(ns).`);
        this.render();
        void this.refreshCurrentRouteData({ silent: true });
      } catch (error) {
        const message = `Nao foi possivel aplicar o import das automations. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          legacyAutomationMigrationDraft: {
            ...this.state.legacyAutomationMigrationDraft,
            applying: false,
            previewLoading: false,
          },
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    const settingsPage = this.readSettingsPageData();

    if (!settingsPage) {
      return;
    }

    const draft = resolveLegacyScheduleMigrationDraft(
      this.state.legacyScheduleMigrationDraft,
      settingsPage.data.legacyScheduleImportFiles,
      settingsPage.data.legacyScheduleImportReport,
    );

    if (!draft.fileName) {
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'warning',
          message: 'Escolhe primeiro o ficheiro weekly legacy que queres importar.',
        },
      };
      this.render();
      return;
    }

    if (action === 'preview-legacy-import') {
      this.state = {
        ...this.state,
        legacyScheduleMigrationDraft: {
          ...this.state.legacyScheduleMigrationDraft,
          previewLoading: true,
        },
        flowFeedback: {
          tone: 'neutral',
          message: 'A gerar preview do import legacy do WA-notify.',
        },
      };
      this.render();

      try {
        const report = await this.currentClient().previewLegacyScheduleImport({
          fileName: draft.fileName,
          requestedBy: 'settings-ui',
        });
        this.state = {
          ...this.state,
          legacyScheduleMigrationDraft: {
            ...this.state.legacyScheduleMigrationDraft,
            previewLoading: false,
            applying: false,
            report,
          },
          flowFeedback: {
            tone: report.totals.ambiguous > 0 || report.totals.missingGroups > 0 ? 'warning' : 'positive',
            message:
              report.totals.ambiguous > 0 || report.totals.missingGroups > 0
                ? 'Preview pronto, mas ha itens ambiguos ou grupos em falta para rever antes do apply.'
                : 'Preview pronto. Podes importar com seguranca quando quiseres.',
          },
        };
        this.recordUxEvent('positive', `Preview de migracao legacy gerado para ${report.sourceFile.fileName}.`);
        this.render();
      } catch (error) {
        const message = `Nao foi possivel gerar o preview do import legacy. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          legacyScheduleMigrationDraft: {
            ...this.state.legacyScheduleMigrationDraft,
            previewLoading: false,
          },
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action !== 'apply-legacy-import') {
      return;
    }

    if (!options.confirmed) {
      this.state = {
        ...this.state,
        pendingConfirmation: {
          domain: 'settings',
          key: `legacy-import:${draft.fileName}`,
          action,
          dataset: {
            legacyScheduleFileName: draft.fileName,
          },
          title: 'Importar schedules legacy para o calendario real?',
          description: `Isto vai criar ou atualizar eventos reais a partir de ${draft.fileName}.`,
          confirmLabel: 'Importar agora',
          tone: 'warning',
        },
        flowFeedback: {
          tone: 'warning',
          message: `Confirma primeiro a importacao real de ${draft.fileName}.`,
        },
      };
      this.render();
      return;
    }

    this.state = {
      ...this.state,
      legacyScheduleMigrationDraft: {
        ...this.state.legacyScheduleMigrationDraft,
        previewLoading: false,
        applying: true,
      },
      flowFeedback: {
        tone: 'neutral',
        message: `A importar ${draft.fileName} para o calendario real do LumeHub.`,
      },
    };
    this.render();

    try {
      const report = await this.currentClient().applyLegacyScheduleImport({
        fileName: draft.fileName,
        requestedBy: 'settings-ui',
      });
      this.state = {
        ...this.state,
        legacyScheduleMigrationDraft: {
          ...this.state.legacyScheduleMigrationDraft,
          previewLoading: false,
          applying: false,
          report,
        },
        flowFeedback: {
          tone: report.totals.ambiguous > 0 || report.totals.missingGroups > 0 ? 'warning' : 'positive',
          message:
            report.totals.ambiguous > 0 || report.totals.missingGroups > 0
              ? `Import aplicado com pontos para rever. ${report.totals.created} criados, ${report.totals.updated} atualizados.`
              : `Import aplicado com sucesso. ${report.totals.created} criados e ${report.totals.updated} atualizados.`,
        },
      };
      this.recordUxEvent('positive', `Import legacy aplicado para ${report.sourceFile.fileName}.`);
      this.render();
      void this.refreshCurrentRouteData({ silent: true });
    } catch (error) {
      const message = `Nao foi possivel aplicar o import legacy. ${readErrorMessage(error)}`;
      this.state = {
        ...this.state,
        legacyScheduleMigrationDraft: {
          ...this.state.legacyScheduleMigrationDraft,
          applying: false,
          previewLoading: false,
        },
        flowFeedback: {
          tone: 'danger',
          message,
        },
      };
      this.recordUxEvent('danger', summarizeTelemetryMessage(message));
      this.render();
    }
  }

  private async handleGroupAction(action: string, dataset: ActionDataset): Promise<void> {
    const page = this.readGroupManagementPageData();

    if (!page) {
      return;
    }

    if (action === 'toggle-assistant-master') {
      const nextEnabled = !page.data.commandSettings.assistantEnabled;

      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: nextEnabled
            ? 'A ligar o master switch do assistente para grupos.'
            : 'A desligar o master switch do assistente para grupos.',
        },
      };
      this.render();

      try {
        await this.currentClient().updateCommandSettings({
          assistantEnabled: nextEnabled,
        });
        this.recordUxEvent(
          nextEnabled ? 'positive' : 'warning',
          nextEnabled ? 'Master switch dos grupos ligado.' : 'Master switch dos grupos desligado.',
        );
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: nextEnabled ? 'positive' : 'warning',
            message: nextEnabled
              ? 'O assistente voltou a ficar disponivel para os grupos autorizados.'
              : 'O assistente ficou bloqueado em todos os grupos ate voltares a ligar.',
          },
        };
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel atualizar o master switch. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action === 'select-group') {
      const groupJid = dataset.groupJid ?? null;
      this.currentRouter().setGroupManagementSelection(groupJid);
      this.state = {
        ...this.state,
        flowFeedback: null,
      };
      if (groupJid) {
        this.navigateToRoute(this.currentRouter().buildGroupRoute(groupJid));
        return;
      }
      await this.refreshCurrentRouteData();
      return;
    }

    if (action === 'refresh-preview') {
      this.currentRouter().setGroupManagementPreviewText(this.state.groupManagementDraft.previewText);
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: 'A reconstruir o contexto deste grupo para veres o preview atualizado.',
        },
      };
      this.render();
      await this.refreshCurrentRouteData();
      return;
    }

    if (action === 'set-group-owner') {
      const groupJid = dataset.groupJid;
      const personId = dataset.personId?.trim() ?? '';
      const group = page.data.groups.find((candidate) => candidate.groupJid === groupJid);

      if (!groupJid || !group) {
        return;
      }

      const nextOwners = personId.length > 0 ? [{ personId }] : [];
      const ownerLabel = personId.length > 0 ? resolvePersonDisplayName(personId, page.data.people) : null;

      await this.runGroupMutation(
        async () => {
          await this.currentClient().replaceGroupOwners(groupJid, nextOwners);
        },
        ownerLabel
          ? `${ownerLabel} ficou como owner operacional de ${group.preferredSubject}.`
          : `O owner operacional de ${group.preferredSubject} ficou limpo.`,
      );
      return;
    }

    if (action === 'set-operational-setting') {
      const groupJid = dataset.groupJid;
      const setting = dataset.setting;
      const value = dataset.value;
      const group = page.data.groups.find((candidate) => candidate.groupJid === groupJid);

      if (!groupJid || !group || !setting || !value) {
        return;
      }

      if (setting === 'mode') {
        if (!isGroupMode(value)) {
          return;
        }

        await this.runGroupMutation(
          async () => {
            await this.currentClient().updateGroupOperationalSettings(groupJid, {
              mode: value,
            });
          },
          `${group.preferredSubject} ficou em modo ${readableGroupMode(value)}.`,
        );
        return;
      }

      if (setting === 'memberTagPolicy') {
        if (!isGroupMemberTagPolicy(value)) {
          return;
        }

        await this.runGroupMutation(
          async () => {
            await this.currentClient().updateGroupOperationalSettings(groupJid, {
              memberTagPolicy: value,
            });
          },
          `${group.preferredSubject}: ${readableGroupMemberTagPolicy(value)}.`,
        );
      }
      return;
    }

    if (action === 'toggle-scheduling-enabled') {
      const groupJid = dataset.groupJid;
      const group = page.data.groups.find((candidate) => candidate.groupJid === groupJid);

      if (!groupJid || !group) {
        return;
      }

      const nextValue = !group.operationalSettings.schedulingEnabled;

      await this.runGroupMutation(
        async () => {
          await this.currentClient().updateGroupOperationalSettings(groupJid, {
            schedulingEnabled: nextValue,
          });
        },
        nextValue
          ? `${group.preferredSubject} voltou a ter agendamento local ativo.`
          : `${group.preferredSubject} ficou sem agendamento local ativo.`,
      );
      return;
    }

    if (action === 'toggle-llm-scheduling') {
      const groupJid = dataset.groupJid;
      const group = page.data.groups.find((candidate) => candidate.groupJid === groupJid);

      if (!groupJid || !group) {
        return;
      }

      const nextValue = !group.operationalSettings.allowLlmScheduling;

      await this.runGroupMutation(
        async () => {
          await this.currentClient().updateGroupOperationalSettings(groupJid, {
            allowLlmScheduling: nextValue,
          });
        },
        nextValue
          ? `A LLM voltou a poder preparar scheduling em ${group.preferredSubject}.`
          : `A LLM deixou de poder preparar scheduling em ${group.preferredSubject}.`,
      );
      return;
    }

    if (action === 'toggle-group-authorized') {
      const groupJid = dataset.groupJid;
      const group = page.data.groups.find((candidate) => candidate.groupJid === groupJid);

      if (!groupJid || !group) {
        return;
      }

      const currentAuthorizedGroupJids = resolveAuthorizedGroupJidsForCommands(
        page.data.groups,
        page.data.commandSettings,
      );
      const nextAuthorizedGroupJids = currentAuthorizedGroupJids.includes(groupJid)
        ? currentAuthorizedGroupJids.filter((candidate) => candidate !== groupJid)
        : dedupeStringList([...currentAuthorizedGroupJids, groupJid]);
      const nextAssistantEnabled = nextAuthorizedGroupJids.length > 0;

      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: currentAuthorizedGroupJids.includes(groupJid)
            ? `A retirar ${group.preferredSubject} da lista autorizada do assistente.`
            : `A autorizar ${group.preferredSubject} para uso do assistente.`,
        },
      };
      this.render();

      try {
        await this.currentClient().updateCommandSettings({
          assistantEnabled: nextAssistantEnabled,
          authorizedGroupJids:
            nextAssistantEnabled && nextAuthorizedGroupJids.length === page.data.groups.length
              ? []
              : nextAuthorizedGroupJids,
        });
        this.recordUxEvent(
          currentAuthorizedGroupJids.includes(groupJid) ? 'warning' : 'positive',
          currentAuthorizedGroupJids.includes(groupJid)
            ? `${group.preferredSubject} deixou de estar autorizado no assistente.`
            : `${group.preferredSubject} ficou autorizado no assistente.`,
        );
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: currentAuthorizedGroupJids.includes(groupJid) ? 'warning' : 'positive',
            message: nextAssistantEnabled
              ? currentAuthorizedGroupJids.includes(groupJid)
                ? `${group.preferredSubject} ficou desligado, mas o assistente continua ativo noutros grupos.`
                : `${group.preferredSubject} ficou ligado para o assistente.`
              : 'O ultimo grupo autorizado foi desligado; o master switch tambem ficou desligado.',
          },
        };
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel atualizar o switch deste grupo. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action === 'save-instructions') {
      const selectedGroupJid = this.state.groupManagementDraft.selectedGroupJid;

      if (!selectedGroupJid) {
        return;
      }

      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: 'A guardar o ficheiro canonico de instrucoes deste grupo.',
        },
      };
      this.render();

      try {
        await this.currentClient().updateGroupLlmInstructions(
          selectedGroupJid,
          this.state.groupManagementDraft.instructions,
        );
        this.recordUxEvent('positive', `Instrucoes do grupo ${selectedGroupJid} guardadas.`);
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'positive',
            message: 'Instrucoes LLM guardadas no ficheiro canonico do grupo.',
          },
        };
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel guardar as instrucoes. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action === 'new-document') {
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: 'Editor limpo para um novo documento deste grupo.',
        },
        groupManagementDraft: {
          ...this.state.groupManagementDraft,
          selectedDocumentId: null,
          knowledgeDocument: createEmptyGroupKnowledgeDraft(),
        },
      };
      this.recordUxEvent('neutral', 'Editor de knowledge base limpo para novo documento.');
      this.render();
      return;
    }

    if (action === 'load-document') {
      const documentId = dataset.groupDocumentId;
      const document = page.data.intelligence?.knowledge.documents.find(
        (candidate) => candidate.documentId === documentId,
      );

      if (!document) {
        return;
      }

      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'positive',
          message: `Documento ${document.title} carregado no editor.`,
        },
        groupManagementDraft: {
          ...this.state.groupManagementDraft,
          selectedDocumentId: document.documentId,
          knowledgeDocument: mapGroupKnowledgeDocumentToDraft(document),
        },
      };
      this.recordUxEvent('positive', `Documento ${document.documentId} aberto no editor.`);
      this.render();
      return;
    }

    if (action === 'save-document') {
      const selectedGroupJid = this.state.groupManagementDraft.selectedGroupJid;

      if (!selectedGroupJid) {
        return;
      }

      const draft = this.state.groupManagementDraft.knowledgeDocument;

      if (!draft.documentId.trim() || !draft.filePath.trim() || !draft.title.trim() || !draft.content.trim()) {
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'warning',
            message: 'Preenche document ID, ficheiro, titulo e conteudo antes de guardar.',
          },
        };
        this.render();
        return;
      }

      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: 'A guardar este documento na knowledge base isolada do grupo.',
        },
      };
      this.render();

      try {
        const saved = await this.currentClient().upsertGroupKnowledgeDocument(selectedGroupJid, {
          documentId: draft.documentId.trim(),
          filePath: draft.filePath.trim(),
          title: draft.title.trim(),
          summary: draft.summary.trim() || null,
          aliases: parseCommaSeparatedValues(draft.aliases),
          tags: parseCommaSeparatedValues(draft.tags),
          enabled: draft.enabled !== 'disabled',
          content: draft.content,
        });
        this.recordUxEvent('positive', `Documento ${saved.documentId} guardado na knowledge base.`);
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'positive',
            message: `Documento ${saved.title} guardado na knowledge base do grupo.`,
          },
        };
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel guardar o documento. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
      return;
    }

    if (action === 'delete-document') {
      const selectedGroupJid = this.state.groupManagementDraft.selectedGroupJid;
      const documentId = dataset.groupDocumentId;

      if (!selectedGroupJid || !documentId) {
        return;
      }

      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: 'A remover este documento da knowledge base do grupo.',
        },
      };
      this.render();

      try {
        const result = await this.currentClient().deleteGroupKnowledgeDocument(selectedGroupJid, documentId);
        this.recordUxEvent(
          result.deleted ? 'positive' : 'warning',
          result.deleted
            ? `Documento ${documentId} removido da knowledge base.`
            : `Tentativa de apagar ${documentId} sem documento existente.`,
        );
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: result.deleted ? 'positive' : 'warning',
            message: result.deleted
              ? 'Documento removido da knowledge base deste grupo.'
              : 'Esse documento ja nao existia quando tentaste apagar.',
          },
        };
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel apagar o documento. ${readErrorMessage(error)}`;
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'danger',
            message,
          },
        };
        this.recordUxEvent('danger', summarizeTelemetryMessage(message));
        this.render();
      }
    }
  }

  private async runGroupMutation(task: () => Promise<void>, successMessage: string): Promise<void> {
    this.state = {
      ...this.state,
      pendingConfirmation: null,
      flowFeedback: {
        tone: 'neutral',
        message: 'A guardar a configuracao operacional deste grupo.',
      },
    };
    this.render();

    try {
      await task();
      await this.refreshCurrentRouteData();
      this.state = {
        ...this.state,
        pendingConfirmation: null,
        flowFeedback: {
          tone: 'positive',
          message: successMessage,
        },
      };
      this.recordUxEvent('positive', successMessage);
    } catch (error) {
      const message = `Nao foi possivel atualizar esta configuracao do grupo. ${readErrorMessage(error)}`;
      this.state = {
        ...this.state,
        pendingConfirmation: null,
        flowFeedback: {
          tone: 'danger',
          message,
        },
      };
      this.recordUxEvent('danger', summarizeTelemetryMessage(message));
    }

    this.render();
  }

  private renderContextRailCards(currentRoute: ResolvedAppRoute): string {
    if (currentRoute.canonicalRoute !== '/groups') {
      return '';
    }

    return '';
  }

  private renderAssistantRail(currentRoute: ResolvedAppRoute): string {
    const groups = this.state.assistantRailChat.availableGroups;
    const selectedGroup =
      groups.find((group) => group.groupJid === this.state.assistantRailChat.selectedGroupJid) ?? null;
    const contextLabel =
      this.state.assistantRailChat.contextMode === 'group'
        ? selectedGroup?.preferredSubject ?? 'Escolhe um grupo'
        : 'Global';

    const historyHtml =
      this.state.assistantRailChat.messages.length > 0
        ? this.state.assistantRailChat.messages
            .map(
              (message) => `
                <article class="rail-chat-message rail-chat-message--${message.role}">
                  <div class="rail-chat-message__meta">
                    ${renderUiBadge({
                      label:
                        message.role === 'user'
                          ? 'Tu'
                          : message.role === 'assistant'
                            ? 'LLM'
                            : message.role === 'error'
                              ? 'Erro'
                              : 'Info',
                      tone:
                        message.role === 'assistant'
                          ? 'positive'
                          : message.role === 'error'
                            ? 'danger'
                            : 'neutral',
                      style: 'chip',
                    })}
                    <span>${escapeHtml(message.contextLabel)}</span>
                    <time>${escapeHtml(formatShortDateTime(message.recordedAt))}</time>
                  </div>
                  <p>${escapeHtml(message.text)}</p>
                </article>
              `,
            )
            .join('')
        : `
          <div class="rail-chat-empty">
            <strong>Sem conversa ainda</strong>
            <p>Escreve uma pergunta e recebe a resposta aqui, sem tocar no WhatsApp.</p>
          </div>
        `;

    return `
      ${this.renderContextRailCards(currentRoute)}
      <section class="surface rail-card rail-chat-card">
        <div class="rail-chat-card__header">
          <div>
            <h3>Perguntar sem sair da pagina</h3>
            <p>Usa o chat para pensar em global ou com contexto de um grupo. A resposta fica sempre aqui na interface.</p>
          </div>
          ${renderUiBadge({
            label: this.state.assistantRailChat.sending ? 'A responder' : `Contexto ${contextLabel}`,
            tone: this.state.assistantRailChat.sending ? 'warning' : 'positive',
          })}
        </div>

        <div class="rail-chat-stack">
          <div class="rail-chat-toolbar">
            <div class="rail-chat-toolbar__group">
              <span class="eyebrow">Responder como</span>
              <div class="control-row">
                ${renderUiToggleButton({
                  label: 'Global',
                  value: 'global',
                  active: this.state.assistantRailChat.contextMode === 'global',
                  kind: 'rail-chat-mode',
                })}
                ${renderUiToggleButton({
                  label: 'Como grupo',
                  value: 'group',
                  active: this.state.assistantRailChat.contextMode === 'group',
                  kind: 'rail-chat-mode',
                })}
              </div>
            </div>
          </div>

          ${
            this.state.assistantRailChat.contextMode === 'group'
              ? `
                ${
                  groups.length > 0
                    ? renderUiSelectField({
                        label: 'Grupo para simular',
                        value: this.state.assistantRailChat.selectedGroupJid ?? '',
                        dataKey: 'railChat.groupJid',
                        options: groups.map((group) => ({
                          value: group.groupJid,
                          label: group.preferredSubject,
                        })),
                        hint: 'A LLM usa as instrucoes deste grupo, mas responde aqui no chat.',
                      })
                    : `
                      <div class="rail-chat-inline-note">
                        <strong>${this.state.assistantRailChat.loadingGroups ? 'A carregar grupos...' : 'Sem grupos disponiveis agora'}</strong>
                        <p>${
                          this.state.assistantRailChat.loadingGroups
                            ? 'O seletor aparece assim que os grupos entrarem no runtime.'
                            : 'Muda para Global ou volta a carregar quando houver grupos disponiveis.'
                        }</p>
                      </div>
                    `
                }
              `
              : ''
          }

          <div class="rail-chat-history" aria-live="polite">
            ${historyHtml}
          </div>

          <div class="rail-chat-composer">
            <label class="ui-field">
              <span class="ui-field__label">Mensagem para a LLM</span>
              <textarea
                class="ui-control ui-control--textarea rail-chat-composer__input"
                rows="5"
                data-field-key="railChat.input"
                data-rail-chat-input="true"
                placeholder="Ex.: Resume o que mudou na Aula 1, ou ajuda-me a responder como se eu estivesse no grupo de Anatomia."
              >${escapeHtml(this.state.assistantRailChat.input)}</textarea>
              <span class="ui-field__hint">Enter envia. Shift + Enter cria nova linha.</span>
            </label>

            <div class="rail-chat-actions">
              ${renderUiActionButton({
                label: this.state.assistantRailChat.sending ? 'A responder...' : 'Enviar pergunta',
                variant: 'primary',
                dataAttributes: { 'rail-action': 'send-chat' },
              })}
              ${renderUiActionButton({
                label: 'Limpar chat',
                variant: 'secondary',
                dataAttributes: { 'rail-action': 'clear-chat' },
              })}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  private async handleRailAction(action: string): Promise<void> {
    if (action === 'clear-chat') {
      this.state = {
        ...this.state,
        assistantRailChat: {
          ...this.state.assistantRailChat,
          input: '',
          messages: createInitialAssistantRailMessages(),
        },
        flowFeedback: {
          tone: 'neutral',
          message: 'Chat lateral limpo. Podes recomecar em global ou com contexto de grupo.',
        },
      };
      this.recordUxEvent('neutral', 'Chat lateral limpo.');
      this.render();
      return;
    }

    if (action !== 'send-chat' || this.state.assistantRailChat.sending) {
      return;
    }

    const prompt = this.state.assistantRailChat.input.trim();

    if (!prompt) {
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'warning',
          message: 'Escreve primeiro a pergunta que queres fazer a esta conversa lateral.',
        },
      };
      this.render();
      return;
    }

    if (this.state.assistantRailChat.contextMode === 'group' && !this.state.assistantRailChat.selectedGroupJid) {
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'warning',
          message: 'Escolhe primeiro o grupo que queres simular antes de pedir resposta a esta LLM.',
        },
      };
      this.render();
      return;
    }

    this.state = {
      ...this.state,
      assistantRailChat: {
        ...this.state.assistantRailChat,
        sending: true,
      },
      flowFeedback: {
        tone: 'neutral',
        message:
          this.state.assistantRailChat.contextMode === 'group'
            ? 'A preparar o contexto do grupo e a pedir resposta a esta LLM.'
            : 'A pedir resposta global a esta LLM, sem enviar nada para o WhatsApp.',
      },
    };
    this.appendAssistantRailMessage(
      'user',
      prompt,
      this.state.assistantRailChat.contextMode === 'group'
        ? buildAssistantRailContextLabel(
            'group',
            this.state.assistantRailChat.selectedGroupJid,
            this.state.assistantRailChat.availableGroups,
          )
        : 'Global',
    );
    this.render();

    try {
      const { input, contextLabel } = await this.buildAssistantRailChatInput(prompt);
      const result = await this.currentClient().llmChat(input);

      this.state = {
        ...this.state,
        assistantRailChat: {
          ...this.state.assistantRailChat,
          input: '',
          sending: false,
        },
        flowFeedback: {
          tone: 'positive',
          message:
            contextLabel === 'Global'
              ? 'Resposta pronta no chat lateral global.'
              : `Resposta pronta no chat lateral com contexto de ${contextLabel}.`,
        },
      };
      this.appendAssistantRailMessage('assistant', result.text, contextLabel);
      this.recordUxEvent('positive', `Chat lateral respondeu em ${contextLabel}.`);
      this.render();
      return;
    } catch (error) {
      const message = `Nao foi possivel obter resposta neste chat lateral. ${readErrorMessage(error)}`;
      this.state = {
        ...this.state,
        assistantRailChat: {
          ...this.state.assistantRailChat,
          sending: false,
        },
        flowFeedback: {
          tone: 'danger',
          message,
        },
      };
      this.appendAssistantRailMessage(
        'error',
        message,
        this.state.assistantRailChat.contextMode === 'group'
          ? buildAssistantRailContextLabel(
              'group',
              this.state.assistantRailChat.selectedGroupJid,
              this.state.assistantRailChat.availableGroups,
            )
          : 'Global',
      );
      this.recordUxEvent('danger', summarizeTelemetryMessage(message));
      this.render();
    }
  }

  private async runWhatsAppMutation(task: () => Promise<void>, successMessage: string): Promise<void> {
    this.state = {
      ...this.state,
      pendingConfirmation: null,
      flowFeedback: {
        tone: 'neutral',
        message: 'A aplicar alteracao nesta area para poderes validar logo o resultado.',
      },
    };
    this.render();

    try {
      await task();
      await this.refreshCurrentRouteData();
      this.state = {
        ...this.state,
        pendingConfirmation: null,
        flowFeedback: {
          tone: 'positive',
          message: successMessage,
        },
      };
      this.recordUxEvent('positive', successMessage);
    } catch (error) {
      const message = `Nao foi possivel atualizar esta configuracao. ${readErrorMessage(error)}`;
      this.state = {
        ...this.state,
        pendingConfirmation: null,
        flowFeedback: {
          tone: 'danger',
          message,
        },
      };
      this.recordUxEvent('danger', summarizeTelemetryMessage(message));
    }

    this.render();
  }

  private async handleWhatsAppAction(
    action: string,
    dataset: ActionDataset,
    options: {
      readonly confirmed?: boolean;
    } = {},
  ): Promise<void> {
    if (action === 'toggle-qr-preview') {
      const nextQrPreviewVisible = !this.state.whatsappQrPreviewVisible;
      this.state = {
        ...this.state,
        whatsappQrPreviewVisible: nextQrPreviewVisible,
        pendingConfirmation: null,
        flowFeedback: null,
      };
      this.recordUxEvent(
        'neutral',
        nextQrPreviewVisible ? 'Preview QR aberto.' : 'Preview QR fechado.',
      );
      this.render();
      return;
    }

    if (action === 'refresh-workspace') {
      await this.runWhatsAppMutation(
        async () => {
          await this.currentClient().refreshWhatsAppWorkspace();
        },
        'O workspace WhatsApp foi atualizado a partir do runtime live.',
      );
      return;
    }

    const pageData = this.readWhatsAppPageData();

    if (!pageData) {
      return;
    }

    const snapshot = pageData.workspace;
    const people = buildWorkspacePeople(pageData);
    const pendingConfirmation = !options.confirmed
      ? this.buildWhatsAppConfirmation(action, dataset, snapshot, people)
      : null;

    if (pendingConfirmation) {
      this.state = {
        ...this.state,
        pendingConfirmation,
        flowFeedback: {
          tone: 'warning',
          message: pendingConfirmation.description,
        },
      };
      this.recordUxEvent('warning', `Confirmacao pedida: ${pendingConfirmation.title}`);
      this.render();
      return;
    }

    if (action === 'toggle-whatsapp-enabled') {
      await this.runWhatsAppMutation(
        async () => {
          await this.currentClient().updateWhatsAppSettings({
            enabled: !snapshot.settings.whatsapp.enabled,
          });
        },
        snapshot.settings.whatsapp.enabled
          ? 'Canal WhatsApp desligado nesta preview para testares o estado de recuperacao.'
          : 'Canal WhatsApp ligado nesta preview para continuares a validacao do fluxo.',
      );
      return;
    }

    if (action === 'toggle-private-assistant-global') {
      await this.runWhatsAppMutation(
        async () => {
          await this.currentClient().updateCommandSettings({
            allowPrivateAssistant: !snapshot.settings.commands.allowPrivateAssistant,
            authorizedPrivateJids: snapshot.settings.commands.allowPrivateAssistant ? [] : [],
          });
        },
        snapshot.settings.commands.allowPrivateAssistant
          ? 'O assistente privado ficou bloqueado globalmente.'
          : 'O assistente privado ficou ativo globalmente para os chats conhecidos.',
      );
      return;
    }

    if (action === 'toggle-shared-auth') {
      await this.runWhatsAppMutation(
        async () => {
          await this.currentClient().updateWhatsAppSettings({
            sharedAuthWithCodex: !snapshot.settings.whatsapp.sharedAuthWithCodex,
          });
        },
        snapshot.settings.whatsapp.sharedAuthWithCodex
          ? 'A preview passou para auth isolado.'
          : 'A preview voltou a partilhar o auth do Codex.',
      );
      return;
    }

    if (action === 'toggle-group-discovery') {
      await this.runWhatsAppMutation(
        async () => {
          await this.currentClient().updateWhatsAppSettings({
            groupDiscoveryEnabled: !snapshot.settings.whatsapp.groupDiscoveryEnabled,
          });
        },
        snapshot.settings.whatsapp.groupDiscoveryEnabled
          ? 'A descoberta de grupos ficou em pausa.'
          : 'A descoberta de grupos voltou a ficar ativa.',
      );
      return;
    }

    if (action === 'toggle-conversation-discovery') {
      await this.runWhatsAppMutation(
        async () => {
          await this.currentClient().updateWhatsAppSettings({
            conversationDiscoveryEnabled: !snapshot.settings.whatsapp.conversationDiscoveryEnabled,
          });
        },
        snapshot.settings.whatsapp.conversationDiscoveryEnabled
          ? 'A descoberta de conversas ficou em pausa.'
          : 'A descoberta de conversas voltou a ficar ativa.',
      );
      return;
    }

    if (action === 'toggle-app-owner') {
      const personId = dataset.personId;
      const person = people.find((candidate) => candidate.personId === personId);

      if (!personId || !person) {
        return;
      }

      const isAppOwner = person.globalRoles.includes('app_owner');
      const nextRoles = dedupePersonRoles(
        isAppOwner
          ? person.globalRoles.filter((role) => role !== 'app_owner')
          : [...person.globalRoles, 'app_owner'],
      );
      const normalizedRoles = nextRoles.length > 0 ? nextRoles : (['member'] as const);

      await this.runWhatsAppMutation(
        async () => {
          await this.currentClient().updatePersonRoles(personId, normalizedRoles);
        },
        isAppOwner
          ? `${person.displayName} deixou de ser app owner.`
          : `${person.displayName} passou a ter controlo global como app owner.`,
      );
      return;
    }

    if (action === 'toggle-private-person') {
      const personId = dataset.personId;
      const person = people.find((candidate) => candidate.personId === personId);

      if (!personId || !person || person.whatsappJids.length === 0) {
        return;
      }

      const knownPrivateJids = dedupeStringList(
        snapshot.conversations.flatMap((conversation) => conversation.whatsappJids),
      );
      const currentAuthorizedPrivateJids = resolveAuthorizedPrivateJids(snapshot);
      const nextAuthorizedPrivateJids = person.privateAssistantAuthorized
        ? currentAuthorizedPrivateJids.filter((chatJid) => !person.whatsappJids.includes(chatJid))
        : dedupeStringList([...currentAuthorizedPrivateJids, ...person.whatsappJids]);
      const nextAllowPrivateAssistant = nextAuthorizedPrivateJids.length > 0;

      await this.runWhatsAppMutation(
        async () => {
          await this.currentClient().updateCommandSettings({
            allowPrivateAssistant: nextAllowPrivateAssistant,
            authorizedPrivateJids:
              nextAllowPrivateAssistant && nextAuthorizedPrivateJids.length === knownPrivateJids.length
                ? []
                : nextAuthorizedPrivateJids,
          });
        },
        person.privateAssistantAuthorized
          ? `O acesso privado de ${person.displayName} ficou bloqueado.`
          : `O acesso privado de ${person.displayName} ficou autorizado.`,
      );
      return;
    }

    if (action === 'toggle-group-authorized') {
      const groupJid = dataset.groupJid;
      const group = snapshot.groups.find((candidate) => candidate.groupJid === groupJid);

      if (!groupJid || !group) {
        return;
      }

      const currentAuthorizedGroupJids = resolveAuthorizedGroupJids(snapshot);
      const nextAuthorizedGroupJids = group.assistantAuthorized
        ? currentAuthorizedGroupJids.filter((candidate) => candidate !== groupJid)
        : dedupeStringList([...currentAuthorizedGroupJids, groupJid]);

      if (nextAuthorizedGroupJids.length === 0) {
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'warning',
            message:
              'O modelo atual precisa de pelo menos um grupo autorizado. Se quiseres parar tudo, usa o controlo global do assistente noutra area.',
          },
        };
        this.render();
        return;
      }

      await this.runWhatsAppMutation(
        async () => {
          await this.currentClient().updateCommandSettings({
            assistantEnabled: true,
            authorizedGroupJids:
              nextAuthorizedGroupJids.length === snapshot.groups.length ? [] : nextAuthorizedGroupJids,
          });
        },
        group.assistantAuthorized
          ? `${group.preferredSubject} deixou de estar autorizado para o assistente.`
          : `${group.preferredSubject} ficou autorizado para o assistente.`,
      );
      return;
    }

    if (action === 'clear-group-owners') {
      const groupJid = dataset.groupJid;
      const group = snapshot.groups.find((candidate) => candidate.groupJid === groupJid);

      if (!groupJid || !group) {
        return;
      }

      await this.runWhatsAppMutation(
        async () => {
          await this.currentClient().replaceGroupOwners(groupJid, []);
        },
        `Os group owners de ${group.preferredSubject} foram limpos nesta preview.`,
      );
      return;
    }

    if (action === 'toggle-group-owner') {
      const groupJid = dataset.groupJid;
      const personId = dataset.personId;
      const group = snapshot.groups.find((candidate) => candidate.groupJid === groupJid);
      const person = people.find((candidate) => candidate.personId === personId);

      if (!groupJid || !personId || !group || !person) {
        return;
      }

      const nextOwnerIds = group.ownerPersonIds.includes(personId)
        ? group.ownerPersonIds.filter((candidate) => candidate !== personId)
        : [...group.ownerPersonIds, personId];

      await this.runWhatsAppMutation(
        async () => {
          await this.currentClient().replaceGroupOwners(
            groupJid,
            nextOwnerIds.map((ownerPersonId) => ({
              personId: ownerPersonId,
            })),
          );
        },
        group.ownerPersonIds.includes(personId)
          ? `${person.displayName} deixou de ser owner de ${group.preferredSubject}.`
          : `${person.displayName} ficou como owner de ${group.preferredSubject}.`,
      );
    }
  }

  private buildWhatsAppConfirmation(
    action: string,
    dataset: ActionDataset,
    snapshot: WhatsAppWorkspaceSnapshot,
    people: readonly WorkspacePersonView[],
  ): PendingConfirmation | null {
    if (action === 'toggle-whatsapp-enabled' && snapshot.settings.whatsapp.enabled) {
      return {
        domain: 'whatsapp',
        key: 'toggle-whatsapp-enabled',
        action,
        dataset,
        title: 'Desligar o canal WhatsApp?',
        description: 'Isto para o canal inteiro ate voltares a liga-lo. Faz sentido confirmar antes de mexer numa operacao tao sensivel.',
        confirmLabel: 'Desligar canal',
        tone: 'danger',
      };
    }

    if (action === 'toggle-private-assistant-global' && snapshot.settings.commands.allowPrivateAssistant) {
      return {
        domain: 'whatsapp',
        key: 'toggle-private-assistant-global',
        action,
        dataset,
        title: 'Bloquear todos os privados?',
        description: 'Esta acao corta o assistente privado para todos os chats conhecidos. Confirma so se for mesmo intencional.',
        confirmLabel: 'Bloquear privados',
        tone: 'warning',
      };
    }

    if (action === 'toggle-app-owner') {
      const person = people.find((candidate) => candidate.personId === dataset.personId);

      if (person?.globalRoles.includes('app_owner')) {
        return {
          domain: 'whatsapp',
          key: `toggle-app-owner:${person.personId}`,
          action,
          dataset,
          title: `Remover ${person.displayName} como app owner?`,
          description: 'Esta pessoa perde controlo global da app. Confirma antes de retirar este nivel de acesso.',
          confirmLabel: 'Remover app owner',
          tone: 'warning',
        };
      }
    }

    if (action === 'toggle-private-person') {
      const person = people.find((candidate) => candidate.personId === dataset.personId);

      if (person?.privateAssistantAuthorized) {
        return {
          domain: 'whatsapp',
          key: `toggle-private-person:${person.personId}`,
          action,
          dataset,
          title: `Bloquear o privado de ${person.displayName}?`,
          description: 'A partir daqui o assistente deixa de responder neste contacto privado.',
          confirmLabel: 'Bloquear privado',
          tone: 'warning',
        };
      }
    }

    if (action === 'toggle-group-authorized') {
      const group = snapshot.groups.find((candidate) => candidate.groupJid === dataset.groupJid);

      if (group?.assistantAuthorized) {
        return {
          domain: 'whatsapp',
          key: `toggle-group-authorized:${group.groupJid}`,
          action,
          dataset,
          title: `Bloquear ${group.preferredSubject}?`,
          description: 'Este grupo deixa de poder usar o assistente. Vale a pena confirmar antes de cortar acesso operacional.',
          confirmLabel: 'Bloquear grupo',
          tone: 'warning',
        };
      }
    }

    if (action === 'clear-group-owners') {
      const group = snapshot.groups.find((candidate) => candidate.groupJid === dataset.groupJid);

      if (group) {
        return {
          domain: 'whatsapp',
          key: `clear-group-owners:${group.groupJid}`,
          action,
          dataset,
          title: `Limpar owners de ${group.preferredSubject}?`,
          description: 'O grupo fica sem owner definido. Faz sentido so se estiveres a preparar uma reatribuicao logo a seguir.',
          confirmLabel: 'Limpar owners',
          tone: 'danger',
        };
      }
    }

    if (action === 'toggle-group-owner') {
      const group = snapshot.groups.find((candidate) => candidate.groupJid === dataset.groupJid);
      const person = people.find((candidate) => candidate.personId === dataset.personId);

      if (group && person && group.ownerPersonIds.includes(person.personId ?? '')) {
        return {
          domain: 'whatsapp',
          key: `toggle-group-owner:${group.groupJid}:${person.personId}`,
          action,
          dataset,
          title: `Remover ${person.displayName} como owner?`,
          description: `${person.displayName} deixa de gerir ${group.preferredSubject}. Confirma antes de retirar esta responsabilidade.`,
          confirmLabel: 'Remover owner',
          tone: 'warning',
        };
      }
    }

    return null;
  }

  private async handleWhatsAppAclChange(
    groupJid: string,
    scope: string,
    nextValue: string,
  ): Promise<void> {
    if (!isCalendarAccessScope(scope) || !isCalendarAccessMode(nextValue)) {
      return;
    }

    const pageData = this.readWhatsAppPageData();
    const group = pageData?.workspace.groups.find((candidate) => candidate.groupJid === groupJid);

    if (!pageData || !group) {
      return;
    }

    await this.runWhatsAppMutation(
      async () => {
        await this.currentClient().updateGroupCalendarAccessPolicy(groupJid, {
          [scope]: nextValue,
        });
      },
      `${group.preferredSubject}: ${describeCalendarScope(scope)} ficou em ${readableCalendarAccessMode(nextValue)}.`,
    );
  }

  private async handlePendingConfirmation(action: 'accept' | 'cancel'): Promise<void> {
    if (action === 'cancel') {
      this.dismissPendingConfirmation('Confirmacao cancelada nesta sessao.');
      this.recordUxEvent('neutral', 'Confirmacao sensivel cancelada.');
      return;
    }

    const pendingConfirmation = this.state.pendingConfirmation;

    if (!pendingConfirmation) {
      return;
    }

    this.state = {
      ...this.state,
      pendingConfirmation: null,
    };

    if (pendingConfirmation.domain === 'flow') {
      await this.handleFlowAction(
        pendingConfirmation.action,
        pendingConfirmation.dataset.flowValue,
        {
          confirmed: true,
        },
      );
      return;
    }

    if (pendingConfirmation.domain === 'assistant') {
      await this.handleAssistantAction(pendingConfirmation.action, pendingConfirmation.dataset, {
        confirmed: true,
      });
      return;
    }

    if (pendingConfirmation.domain === 'settings') {
      await this.handleSettingsAction(pendingConfirmation.action, pendingConfirmation.dataset, {
        confirmed: true,
      });
      return;
    }

    if (pendingConfirmation.domain === 'workspace') {
      await this.handleWorkspaceAction(pendingConfirmation.action, pendingConfirmation.dataset, {
        confirmed: true,
      });
      return;
    }

    await this.handleWhatsAppAction(pendingConfirmation.action, pendingConfirmation.dataset, {
      confirmed: true,
    });
  }

  private bindInteractions(): void {
    if (!this.root) {
      return;
    }

    for (const link of this.root.querySelectorAll<HTMLElement>('[data-route]')) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const nextRoute = link.dataset.route;

        if (!nextRoute) {
          return;
        }

        this.navigateToRoute(nextRoute);
      });
    }

    for (const field of this.root.querySelectorAll<HTMLSelectElement>('[data-shell-group-switcher]')) {
      field.addEventListener('change', () => {
        void this.handleShellGroupSwitch(field.value);
      });
    }

    for (const field of this.root.querySelectorAll<HTMLSelectElement>('[data-group-page-switcher]')) {
      field.addEventListener('change', () => {
        void this.handleGroupAction('select-group', {
          groupJid: field.value,
        });
      });
    }

    for (const field of this.root.querySelectorAll<HTMLSelectElement>('[data-group-owner-select]')) {
      field.addEventListener('change', () => {
        void this.handleGroupAction('set-group-owner', {
          groupJid: field.dataset.groupJid,
          personId: field.value,
        });
      });
    }

    for (const field of this.root.querySelectorAll<HTMLSelectElement>('[data-group-operational-setting]')) {
      field.addEventListener('change', () => {
        void this.handleGroupAction('set-operational-setting', {
          groupJid: field.dataset.groupJid,
          setting: field.dataset.groupOperationalSetting,
          value: field.value,
        });
      });
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
      button.addEventListener('click', () => {
        const nextMode = button.dataset.mode as FrontendTransportMode | undefined;

        if (!nextMode || nextMode === this.state.mode) {
          return;
        }

        this.state = {
          ...this.state,
          mode: nextMode,
          pendingConfirmation: null,
          liveEvents: [],
          assistantRailChat: {
            ...this.state.assistantRailChat,
            availableGroups: [],
            loadingGroups: false,
          },
        };
        this.recordUxEvent('neutral', `Modo de dados trocado para ${nextMode}.`);
        void this.loadCurrentRoute({ replaceHistory: true });
      });
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-preview]')) {
      button.addEventListener('click', () => {
        const nextPreview = button.dataset.preview as PreviewState | undefined;

        if (!nextPreview) {
          return;
        }

        this.state = {
          ...this.state,
          previewState: nextPreview,
          pendingConfirmation: null,
        };
        this.recordUxEvent('neutral', `Estado de preview trocado para ${nextPreview}.`);
        void this.loadCurrentRoute({ replaceHistory: true });
      });
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-details-mode]')) {
      button.addEventListener('click', () => {
        const nextMode = button.dataset.detailsMode;

        if (nextMode === 'essential') {
          if (!this.state.advancedDetailsEnabled) {
            return;
          }
          this.setAdvancedDetailsEnabled(false);
          return;
        }

        if (nextMode === 'advanced') {
          if (this.state.advancedDetailsEnabled) {
            return;
          }
          this.setAdvancedDetailsEnabled(true);
        }
      });
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-rail-chat-mode]')) {
      button.addEventListener('click', () => {
        const nextMode = button.dataset.railChatMode;

        if (nextMode !== 'global' && nextMode !== 'group') {
          return;
        }

        this.updateGuidedField('railChat.contextMode', nextMode);
      });
    }

    for (const field of this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-field-key]')) {
      const sync = () => {
        const fieldKey = field.dataset.fieldKey;

        if (!fieldKey) {
          return;
        }

        this.updateGuidedField(fieldKey, field.value);
      };

      field.addEventListener(field instanceof HTMLSelectElement ? 'change' : 'input', sync);
    }

    for (const element of this.root.querySelectorAll<HTMLElement>('[data-flow-action]')) {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        const action = element.dataset.flowAction;

        if (!action) {
          return;
        }

        void this.handleFlowAction(action, element.dataset.flowValue);
      });
    }

    for (const element of this.root.querySelectorAll<HTMLElement>('[data-group-action]')) {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        const action = element.dataset.groupAction;

        if (!action) {
          return;
        }

        void this.handleGroupAction(action, element.dataset);
      });
    }

    for (const element of this.root.querySelectorAll<HTMLElement>('[data-assistant-action]')) {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        const action = element.dataset.assistantAction;

        if (!action) {
          return;
        }

        void this.handleAssistantAction(action, element.dataset);
      });
    }

    for (const element of this.root.querySelectorAll<HTMLElement>('[data-settings-action]')) {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        const action = element.dataset.settingsAction;

        if (!action) {
          return;
        }

        void this.handleSettingsAction(action, element.dataset);
      });
    }

    for (const element of this.root.querySelectorAll<HTMLElement>('[data-workspace-action]')) {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        const action = element.dataset.workspaceAction;

        if (!action) {
          return;
        }

        void this.handleWorkspaceAction(action, element.dataset);
      });
    }

    for (const element of this.root.querySelectorAll<HTMLElement>('[data-whatsapp-action]')) {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        const action = element.dataset.whatsappAction;

        if (!action) {
          return;
        }

        void this.handleWhatsAppAction(action, element.dataset);
      });
    }

    for (const element of this.root.querySelectorAll<HTMLElement>('[data-rail-action]')) {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        const action = element.dataset.railAction;

        if (!action) {
          return;
        }

        void this.handleRailAction(action);
      });
    }

    for (const field of this.root.querySelectorAll<HTMLTextAreaElement>('[data-rail-chat-input]')) {
      field.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          void this.handleRailAction('send-chat');
        }
      });
    }

    for (const field of this.root.querySelectorAll<HTMLSelectElement>('[data-whatsapp-acl-scope]')) {
      field.addEventListener('change', () => {
        const groupJid = field.dataset.whatsappAclGroupJid;
        const scope = field.dataset.whatsappAclScope;

        if (!groupJid || !scope) {
          return;
        }

        void this.handleWhatsAppAclChange(groupJid, scope, field.value);
      });
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-confirm-action]')) {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const action = button.dataset.confirmAction;

        if (action === 'accept' || action === 'cancel') {
          void this.handlePendingConfirmation(action);
        }
      });
    }
  }

  private syncUrl(replaceHistory: boolean): void {
    const params = new URLSearchParams();

    if (this.state.mode === 'live') {
      params.set('mode', 'live');
    }

    if (this.state.previewState !== 'none') {
      params.set('state', this.state.previewState);
    }

    if (this.state.advancedDetailsEnabled) {
      params.set('details', 'advanced');
    }

    const nextPath = this.currentRouter().resolveRoute(this.state.route).route;
    const nextUrl = `${nextPath}${params.size > 0 ? `?${params.toString()}` : ''}`;

    if (replaceHistory) {
      window.history.replaceState({}, '', nextUrl);
      return;
    }

    window.history.pushState({}, '', nextUrl);
  }

  private navigateToRoute(nextRoute: string, options: { readonly replaceHistory?: boolean } = {}): void {
    this.state = {
      ...this.state,
      pendingConfirmation: null,
      route: this.currentRouter().normalizeRoute(nextRoute),
    };
    void this.loadCurrentRoute({ replaceHistory: options.replaceHistory });
  }

  private async handleShellGroupSwitch(groupJid: string): Promise<void> {
    if (!groupJid) {
      return;
    }

    this.currentRouter().setGroupManagementSelection(groupJid);
    this.state = {
      ...this.state,
      flowFeedback: null,
      assistantRailChat: {
        ...this.state.assistantRailChat,
        selectedGroupJid: groupJid,
      },
      assistantSchedulingDraft: {
        ...this.state.assistantSchedulingDraft,
        groupJid,
      },
    };
    this.navigateToRoute(this.currentRouter().buildGroupRoute(groupJid));
  }

  private captureScrollSnapshot(): ScrollSnapshot {
    return {
      left: window.scrollX,
      top: window.scrollY,
    };
  }

  private restoreScrollSnapshot(snapshot: ScrollSnapshot | null): void {
    if (!snapshot) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({
        left: snapshot.left,
        top: snapshot.top,
        behavior: 'auto',
      });
    });
  }

  private readMode(search: string): FrontendTransportMode {
    return new URLSearchParams(search).get('mode') === 'live' ? 'live' : 'demo';
  }

  private readAdvancedDetailsPreference(search: string): boolean {
    const value = new URLSearchParams(search).get('details');

    if (value === 'advanced') {
      return true;
    }

    return readStoredAdvancedDetailsPreference();
  }

  private readPreviewState(search: string): PreviewState {
    const state = new URLSearchParams(search).get('state');

    if (state === 'loading' || state === 'empty' || state === 'offline' || state === 'error') {
      return state;
    }

    return 'none';
  }
}

function createInitialAssistantRailMessages(): readonly AssistantRailMessage[] {
  return [];
}

function createInitialAssistantRailChatState(): AssistantRailChatState {
  return {
    contextMode: 'global',
    selectedGroupJid: null,
    input: '',
    availableGroups: [],
    loadingGroups: false,
    sending: false,
    messages: createInitialAssistantRailMessages(),
  };
}

function resolveAssistantRailSelectedGroupJid(
  selectedGroupJid: string | null,
  groups: readonly Group[],
  preferredGroupJid: string | null,
): string | null {
  if (selectedGroupJid && groups.some((group) => group.groupJid === selectedGroupJid)) {
    return selectedGroupJid;
  }

  if (preferredGroupJid && groups.some((group) => group.groupJid === preferredGroupJid)) {
    return preferredGroupJid;
  }

  return groups[0]?.groupJid ?? null;
}

function buildAssistantRailContextLabel(
  contextMode: AssistantRailChatState['contextMode'],
  selectedGroupJid: string | null,
  groups: readonly Group[],
  preview?: GroupContextPreviewSnapshot,
): string {
  if (contextMode !== 'group') {
    return 'Global';
  }

  return (
    preview?.group?.preferredSubject ??
    groups.find((group) => group.groupJid === selectedGroupJid)?.preferredSubject ??
    'Grupo'
  );
}

function buildAssistantRailGroupChatInput(input: {
  readonly prompt: string;
  readonly preview: GroupContextPreviewSnapshot;
  readonly baseContextSummary: readonly string[];
}): LlmChatInput {
  const { prompt, preview, baseContextSummary } = input;
  const groupLabel = preview.group?.preferredSubject ?? preview.groupJid ?? 'grupo atual';
  const contextSummary = [
    ...baseContextSummary,
    `Contexto pedido: responder como se estivesses no grupo ${groupLabel}, mas sempre neste chat local.`,
    `Texto atual do operador: ${prompt}`,
  ];
  const domainFacts = [
    `Grupo ativo: ${groupLabel}.`,
    preview.groupInstructions
      ? `Instrucoes do grupo: ${truncateText(preview.groupInstructions, 1200)}`
      : 'Este grupo ainda nao tem instrucoes especificas guardadas.',
    ...preview.groupKnowledgeSnippets.slice(0, 4).map((snippet) => `Knowledge ${snippet.title}: ${truncateText(snippet.excerpt, 320)}`),
  ];

  return {
    text: prompt,
    intent: 'sidebar_group_chat',
    contextSummary,
    domainFacts,
  };
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function createPreviewPage(route: ResolvedAppRoute, previewState: PreviewState): UiPage<null> {
  const suffix = previewState === 'empty' ? 'Sem dados simulados.' : 'Preview state simulado.';

  return {
    route: route.route,
    title: route.label,
    description: `${route.description} ${suffix}`,
    sections: [],
    data: null,
  };
}

function mapPreviewStateToScreenState(previewState: PreviewState): ScreenState {
  switch (previewState) {
    case 'loading':
      return 'loading';
    case 'empty':
      return 'empty';
    case 'offline':
      return 'offline';
    case 'error':
      return 'error';
    default:
      return 'ready';
  }
}

function resolveScheduleDraft(
  draft: GuidedScheduleDraft,
  groups: readonly WeekPlannerSnapshot['groups'][number][],
): GuidedScheduleDraft {
  const fallbackGroup = groups[0] ?? null;
  const selectedGroup =
    groups.find((group) => group.groupJid === draft.groupJid) ??
    fallbackGroup;

  return {
    eventId: draft.eventId,
    groupJid: selectedGroup?.groupJid ?? '',
    title: draft.title || (selectedGroup ? `Sessao ${selectedGroup.preferredSubject}` : ''),
    dayLabel: draft.dayLabel,
    startTime: draft.startTime,
    durationMinutes: draft.durationMinutes,
    notes: draft.notes,
  };
}

function createEmptyScheduleDraft(): GuidedScheduleDraft {
  return {
    eventId: null,
    groupJid: '',
    title: '',
    dayLabel: 'sexta-feira',
    startTime: '18:30',
    durationMinutes: '60',
    notes: '',
  };
}

function createEmptyMediaDistributionDraft(): GuidedMediaDistributionDraft {
  return {
    assetId: null,
    caption: '',
    targetGroupJids: [],
  };
}

function createEmptyWorkspaceAgentDraft(): WorkspaceAgentDraft {
  return {
    mode: 'plan',
    prompt: '',
    query: '',
    searchResults: [],
    selectedFilePaths: [],
    previewPath: null,
    previewContent: null,
    searching: false,
    loadingPreview: false,
    running: false,
  };
}

function createEmptyAssistantSchedulingDraft(): AssistantSchedulingDraft {
  return {
    groupJid: '',
    text: '',
    previewLoading: false,
    applying: false,
    preview: null,
    lastApplied: null,
  };
}

function createEmptyLegacyScheduleMigrationDraft(): LegacyScheduleMigrationDraft {
  return {
    fileName: '',
    previewLoading: false,
    applying: false,
    report: null,
  };
}

function createEmptyLegacyAlertMigrationDraft(): LegacyAlertMigrationDraft {
  return {
    previewLoading: false,
    applying: false,
    report: null,
  };
}

function createEmptyLegacyAutomationMigrationDraft(): LegacyAutomationMigrationDraft {
  return {
    previewLoading: false,
    applying: false,
    report: null,
  };
}

function resolveAssistantSchedulingGroupJid(
  selectedGroupJid: string,
  groups: readonly Group[],
): string {
  if (selectedGroupJid && groups.some((group) => group.groupJid === selectedGroupJid)) {
    return selectedGroupJid;
  }

  return groups[0]?.groupJid ?? '';
}

function resolveAssistantSchedulingDraft(
  draft: AssistantSchedulingDraft,
  groups: readonly Group[],
): AssistantSchedulingDraft {
  return {
    ...draft,
    groupJid: resolveAssistantSchedulingGroupJid(draft.groupJid, groups),
  };
}

function resolveLegacyScheduleMigrationDraft(
  draft: LegacyScheduleMigrationDraft,
  files: readonly LegacyScheduleImportFileSnapshot[],
  report: LegacyScheduleImportReportSnapshot | null,
): LegacyScheduleMigrationDraft {
  const selectedFileName =
    (draft.fileName && files.some((file) => file.fileName === draft.fileName) ? draft.fileName : null) ??
    report?.sourceFile.fileName ??
    files[0]?.fileName ??
    '';

  return {
    ...draft,
    fileName: selectedFileName,
    report: report ?? draft.report,
  };
}

function resolveLegacyAlertMigrationDraft(
  draft: LegacyAlertMigrationDraft,
  report: LegacyAlertImportReportSnapshot | null,
): LegacyAlertMigrationDraft {
  return {
    ...draft,
    report: report ?? draft.report,
  };
}

function resolveLegacyAutomationMigrationDraft(
  draft: LegacyAutomationMigrationDraft,
  report: LegacyAutomationImportReportSnapshot | null,
): LegacyAutomationMigrationDraft {
  return {
    ...draft,
    report: report ?? draft.report,
  };
}

function buildWorkspaceReviewPrompt(relativePath: string): string {
  return [
    `Reve o ficheiro ${relativePath}.`,
    'Nao alteres nada.',
    'Explica de forma curta:',
    '- o que este ficheiro faz',
    '- riscos ou problemas encontrados',
    '- se vale a pena mexer noutro ficheiro a seguir',
  ].join(' ');
}

function readableAssistantOperation(operation: 'create' | 'update' | 'delete' | null): string {
  switch (operation) {
    case 'create':
      return 'Criar';
    case 'update':
      return 'Atualizar';
    case 'delete':
      return 'Apagar';
    default:
      return 'Sem operacao';
  }
}

function describeAssistantConversationMemory(
  entry: AssistantPageData['recentConversationAudit'][number],
): string {
  if (!entry.memoryUsage || entry.memoryUsage.scope !== 'group') {
    return 'Sem memoria de grupo';
  }

  const documentLabel =
    entry.memoryUsage.knowledgeDocuments.length > 0
      ? `docs ${entry.memoryUsage.knowledgeDocuments
          .slice(0, 2)
          .map((document) => document.title)
          .join(', ')}`
      : 'sem docs';

  return [
    `grupo ${entry.memoryUsage.groupLabel ?? entry.memoryUsage.groupJid ?? 'desconhecido'}`,
    `instr ${entry.memoryUsage.instructionsSource ?? 'missing'}`,
    `${entry.memoryUsage.knowledgeSnippetCount} snippet(s)`,
    documentLabel,
  ].join(' | ');
}

function readableInstructionStatus(status: Instruction['status']): string {
  switch (status) {
    case 'queued':
      return 'Em fila';
    case 'running':
      return 'A correr';
    case 'completed':
      return 'Concluido';
    case 'partial_failed':
      return 'Falha parcial';
    case 'failed':
      return 'Falhou';
    default:
      return status;
  }
}

function toneForInstructionStatus(status: Instruction['status']): UiTone {
  switch (status) {
    case 'completed':
      return 'positive';
    case 'queued':
    case 'running':
      return 'warning';
    case 'partial_failed':
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

function buildWorkspaceDraftContextSummary(draft: WorkspaceAgentDraft): {
  readonly summary: string;
  readonly badgeLabel: string;
  readonly badgeTone: UiTone;
  readonly chips: readonly string[];
} {
  const selectedCount = draft.selectedFilePaths.length;
  const previewPath = draft.previewContent?.relativePath ?? draft.previewPath;
  const chips = [
    draft.mode === 'plan' ? 'So leitura' : 'Pode editar',
    selectedCount > 0 ? `${selectedCount} ficheiro(s) em foco` : 'Sem foco explicito',
    previewPath ? `Preview: ${previewPath}` : 'Sem preview aberto',
  ];

  if (draft.mode === 'apply') {
    return {
      summary:
        selectedCount > 0
          ? 'O agente vai começar pelos ficheiros em foco e pode abrir outros se precisar para fechar a alteracao.'
          : 'O agente pode explorar o repo inteiro antes de alterar. Marca ficheiros se quiseres reduzir o raio de acao.',
      badgeLabel: selectedCount > 0 ? 'Apply guiado' : 'Apply aberto',
      badgeTone: selectedCount > 0 ? 'warning' : 'danger',
      chips,
    };
  }

  return {
    summary:
      previewPath
        ? 'O modo de leitura esta pronto para rever o ficheiro aberto ou gerar um plano antes de editar.'
        : 'Usa este modo para perceber a abordagem, pedir revisao ou limitar melhor o contexto antes de aplicar.',
    badgeLabel: 'Seguro para rever',
    badgeTone: 'positive',
    chips,
  };
}

function mapScheduleEventToDraft(
  event: Pick<WeekPlannerSnapshot['events'][number], 'eventId' | 'groupJid' | 'title' | 'dayLabel' | 'startTime' | 'durationMinutes' | 'notes'>,
): GuidedScheduleDraft {
  return {
    eventId: event.eventId,
    groupJid: event.groupJid,
    title: event.title,
    dayLabel: event.dayLabel,
    startTime: event.startTime,
    durationMinutes: String(event.durationMinutes),
    notes: event.notes,
  };
}

function buildScheduleExample(
  group: WeekPlannerSnapshot['groups'][number],
  index: number,
): {
  readonly title: string;
  readonly groupLabel: string;
  readonly dayLabel: string;
  readonly startTime: string;
  readonly durationMinutes: string;
  readonly notes: string;
} {
  const presets = [
    {
      title: `Aula regular ${group.preferredSubject}`,
      dayLabel: 'sexta-feira',
      startTime: '18:30',
      durationMinutes: '60',
      notes: 'Confirmar sala habitual e manter avisos default.',
    },
    {
      title: `Reposicao ${group.preferredSubject}`,
      dayLabel: 'sabado',
      startTime: '11:00',
      durationMinutes: '75',
      notes: 'Avisar que esta sessao substitui a aula perdida da semana.',
    },
    {
      title: `Sessao especial ${group.preferredSubject}`,
      dayLabel: 'quarta-feira',
      startTime: '20:00',
      durationMinutes: '90',
      notes: 'Usar mensagem curta, indicar material necessario e pedir confirmacao.',
    },
  ] as const;

  return {
    ...(presets[index] ?? presets[0]),
    groupLabel: group.preferredSubject,
  };
}

function renderWeekCalendarEventCard(
  event: WeekPlannerSnapshot['events'][number],
  active: boolean,
): string {
  const status = describeWeekCalendarEventStatus(event);

  return `
    <article class="week-event-card week-event-card--${status.tone}${active ? ' week-event-card--active' : ''}" data-week-event-id="${escapeHtml(event.eventId)}">
      <div class="week-event-card__header">
        <div>
          <p class="week-calendar__eyebrow">${escapeHtml(`${event.startTime} · ${event.durationMinutes} min`)}</p>
          <h4>${escapeHtml(event.title)}</h4>
        </div>
        ${renderUiBadge({ label: status.label, tone: status.tone })}
      </div>
      <p class="week-event-card__group">${escapeHtml(event.groupLabel)}</p>
      <p class="week-event-card__notes">${escapeHtml(event.notes || 'Sem nota interna.')}</p>
      <div class="ui-card__chips">
        ${renderUiBadge({ label: `${event.notificationRuleLabels.length} aviso(s)`, tone: 'positive', style: 'chip' })}
        ${renderUiBadge({ label: `pending ${event.notifications.pending}`, tone: event.notifications.pending > 0 ? 'neutral' : 'positive', style: 'chip' })}
        ${renderUiBadge({
          label: `waiting_confirmation ${event.notifications.waitingConfirmation}`,
          tone: event.notifications.waitingConfirmation > 0 ? 'warning' : 'neutral',
          style: 'chip',
        })}
        ${renderUiBadge({ label: `sent ${event.notifications.sent}`, tone: event.notifications.sent > 0 ? 'positive' : 'neutral', style: 'chip' })}
      </div>
      <dl class="week-event-card__stats">
        <div>
          <dt>Dia</dt>
          <dd>${escapeHtml(readableWeekDayLabel(event.dayLabel))}</dd>
        </div>
        <div>
          <dt>Data</dt>
          <dd>${escapeHtml(formatWeekDayDateLabel(event.localDate))}</dd>
        </div>
        <div>
          <dt>Grupo</dt>
          <dd>${escapeHtml(event.groupLabel)}</dd>
        </div>
      </dl>
      <div class="action-row">
        ${renderUiActionButton({
          label: 'Editar',
          variant: 'secondary',
          dataAttributes: {
            'flow-action': 'schedule-load-event',
            'flow-value': event.eventId,
          },
        })}
        ${renderUiActionButton({
          label: 'Desativar',
          variant: 'secondary',
          dataAttributes: {
            'flow-action': 'schedule-delete',
            'flow-value': event.eventId,
          },
        })}
      </div>
    </article>
  `;
}

function describeWeekCalendarEventStatus(event: WeekPlannerSnapshot['events'][number]): {
  readonly label: string;
  readonly tone: UiTone;
} {
  if (event.notifications.waitingConfirmation > 0) {
    return {
      label: `${event.notifications.waitingConfirmation} a aguardar`,
      tone: 'warning',
    };
  }

  if (event.notifications.pending > 0) {
    return {
      label: `${event.notifications.pending} pendentes`,
      tone: 'neutral',
    };
  }

  if (event.notifications.sent > 0) {
    return {
      label: 'Enviado',
      tone: 'positive',
    };
  }

  return {
    label: 'Sem avisos',
    tone: 'neutral',
  };
}

function buildWeekCalendarDays(snapshot: WeekPlannerSnapshot): readonly WeekCalendarDayView[] {
  const weekDates = resolveIsoWeekDates(snapshot.focusWeekLabel);
  const today = new Date().toISOString().slice(0, 10);

  return WEEK_DAY_OPTIONS.map((option, index) => {
    const localDate = weekDates[index] ?? resolveExistingDateForDay(snapshot.events, option.value) ?? '';
    const events = snapshot.events
      .filter((event) => {
        if (localDate && event.localDate === localDate) {
          return true;
        }

        return normalizeWeekDayLabel(event.dayLabel) === option.value;
      })
      .slice()
      .sort(
        (left, right) =>
          left.startTime.localeCompare(right.startTime) ||
          left.title.localeCompare(right.title) ||
          left.eventId.localeCompare(right.eventId),
      );

    return {
      dayLabel: option.value,
      label: option.label,
      shortLabel: option.shortLabel,
      localDate,
      dateLabel: localDate ? formatWeekDayDateLabel(localDate) : option.shortLabel,
      events,
      notifications: {
        pendingNotifications: events.reduce((sum, event) => sum + event.notifications.pending, 0),
        waitingConfirmationNotifications: events.reduce(
          (sum, event) => sum + event.notifications.waitingConfirmation,
          0,
        ),
        sentNotifications: events.reduce((sum, event) => sum + event.notifications.sent, 0),
      },
      isToday: localDate === today,
    };
  });
}

function resolveIsoWeekDates(weekLabel: string): readonly string[] {
  const match = /^(\d{4})-W(\d{2})$/u.exec(weekLabel);

  if (!match) {
    return [];
  }

  const year = Number.parseInt(match[1] ?? '', 10);
  const week = Number.parseInt(match[2] ?? '', 10);

  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) {
    return [];
  }

  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthDay = januaryFourth.getUTCDay() || 7;
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - januaryFourthDay + 1 + (week - 1) * 7);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday);
    current.setUTCDate(monday.getUTCDate() + index);
    return current.toISOString().slice(0, 10);
  });
}

function resolveExistingDateForDay(
  events: readonly WeekPlannerSnapshot['events'][number][],
  dayLabel: WeekDayValue,
): string | null {
  return events.find((event) => normalizeWeekDayLabel(event.dayLabel) === dayLabel)?.localDate ?? null;
}

function readableWeekDayLabel(dayLabel: string): string {
  const normalized = normalizeWeekDayLabel(dayLabel);
  return WEEK_DAY_OPTIONS.find((option) => option.value === normalized)?.label ?? dayLabel;
}

function normalizeWeekDayLabel(dayLabel: string): string {
  return dayLabel
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatWeekDayDateLabel(localDate: string): string {
  const [, month, day] = localDate.split('-');
  const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthIndex = Number.parseInt(month ?? '', 10) - 1;
  const safeDay = day ?? localDate;

  if (!month || !day || monthIndex < 0 || monthIndex >= monthLabels.length) {
    return localDate;
  }

  return `${safeDay} ${monthLabels[monthIndex]}`;
}

function resolveDistributionDraft(
  draft: GuidedDistributionDraft,
  rules: readonly RoutingConsoleSnapshot['rules'][number][],
): GuidedDistributionDraft {
  const fallbackRule = rules[0] ?? null;
  const selectedRule = rules.find((rule) => rule.ruleId === draft.ruleId) ?? fallbackRule;

  return {
    ruleId: selectedRule?.ruleId ?? '',
    messageSummary: draft.messageSummary,
    urgency: draft.urgency,
    confirmationMode: draft.confirmationMode,
  };
}

function resolveMediaDistributionDraft(
  draft: GuidedMediaDistributionDraft,
  assets: readonly MediaAssetSnapshot[],
  groups: readonly Group[],
): GuidedMediaDistributionDraft {
  const preferredAssets = assets.filter((asset) => asset.mediaType === 'video');
  const availableAssets = preferredAssets.length > 0 ? preferredAssets : assets;
  const selectedAsset =
    availableAssets.find((asset) => asset.assetId === draft.assetId) ??
    assets.find((asset) => asset.assetId === draft.assetId) ??
    availableAssets[0] ??
    null;
  const knownGroupJids = new Set(groups.map((group) => group.groupJid));

  return {
    assetId: selectedAsset?.assetId ?? null,
    caption: draft.caption.trim().length > 0 ? draft.caption : selectedAsset?.caption ?? '',
    targetGroupJids: dedupeStringList(draft.targetGroupJids.filter((groupJid) => knownGroupJids.has(groupJid))),
  };
}

function readableConfirmationMode(mode: string, requiresConfirmation: boolean): string {
  switch (mode) {
    case 'force_confirmation':
      return 'Pedir confirmacao antes do fan-out';
    case 'direct':
      return 'Distribuicao direta';
    default:
      return requiresConfirmation ? 'Usar confirmacao da regra' : 'Usar distribuicao direta da regra';
  }
}

function resolveDistributionExecutionMode(
  confirmationMode: string,
  requiresConfirmation: boolean,
): 'dry_run' | 'confirmed' {
  if (confirmationMode === 'force_confirmation') {
    return 'dry_run';
  }

  if (confirmationMode === 'direct') {
    return 'confirmed';
  }

  return requiresConfirmation ? 'dry_run' : 'confirmed';
}

function readableRepairFocus(value: 'auth' | 'groups' | 'permissions'): string {
  switch (value) {
    case 'auth':
      return 'Verificar auth';
    case 'groups':
      return 'Rever grupos';
    case 'permissions':
      return 'Rever permissoes';
  }
}

function repairTone(
  focus: 'auth' | 'groups' | 'permissions',
  snapshot: WhatsAppWorkspaceSnapshot,
): UiTone {
  if (focus === 'auth') {
    return toneForSessionPhase(snapshot.runtime.session.phase);
  }

  if (focus === 'groups') {
    return snapshot.permissionSummary.knownGroups > 0 ? 'positive' : 'warning';
  }

  return snapshot.permissionSummary.appOwners > 0 ? 'positive' : 'warning';
}

function renderRepairChecklist(
  focus: 'auth' | 'groups' | 'permissions',
  snapshot: WhatsAppWorkspaceSnapshot,
): string {
  if (focus === 'auth') {
    return `
      <ul>
        <li>Confirmar a fase live da sessao: idealmente deve passar para <strong>open</strong>.</li>
        <li>Se houver QR ativo, scan imediato com a conta operadora antes de rever permissoes.</li>
        <li>Se houver erro ou reconnect, validar primeiro isso antes de confiar na discovery.</li>
        <li>Estado atual: ${escapeHtml(readableSessionPhase(snapshot.runtime.session.phase))}.</li>
      </ul>
    `;
  }

  if (focus === 'groups') {
    return `
      <ul>
        <li>Validar se a descoberta de grupos esta ativa.</li>
        <li>Forcar refresh live se acabaste de entrar num grupo novo e ele ainda nao apareceu.</li>
        <li>Comparar grupos conhecidos com grupos autorizados para o assistente.</li>
        <li>Se houver grupos sem owner, resolver isso antes de confiar no fluxo humano.</li>
        <li>Estado atual: ${snapshot.permissionSummary.authorizedGroups}/${snapshot.permissionSummary.knownGroups} grupos autorizados.</li>
      </ul>
    `;
  }

  return `
    <ul>
      <li>Verificar quem e app owner e quem e group owner.</li>
      <li>Rever ACL do calendario para confirmar se faz sentido humano.</li>
      <li>Confirmar se o assistente privado esta alinhado com a politica pretendida.</li>
      <li>Estado atual: ${snapshot.permissionSummary.appOwners} app owners conhecidos.</li>
    </ul>
  `;
}

function readableSessionPhase(phase: WhatsAppWorkspaceSnapshot['runtime']['session']['phase']): string {
  switch (phase) {
    case 'disabled':
      return 'Canal desligado';
    case 'idle':
      return 'Pronto a ligar';
    case 'connecting':
      return 'A ligar';
    case 'qr_pending':
      return 'Aguardando QR';
    case 'open':
      return 'Ligado';
    case 'closed':
      return 'Sessao fechada';
    case 'error':
      return 'Com erro';
  }
}

function toneForSessionPhase(phase: WhatsAppWorkspaceSnapshot['runtime']['session']['phase']): UiTone {
  switch (phase) {
    case 'open':
      return 'positive';
    case 'connecting':
    case 'qr_pending':
      return 'warning';
    case 'error':
      return 'danger';
    default:
      return 'neutral';
  }
}

function readableWorkspaceRunResult(run: WorkspaceAgentRunSnapshot): string {
  if (run.executionState === 'rejected') {
    return 'Rejeitada por guardrail';
  }

  switch (run.status) {
    case 'completed':
      return 'Concluida';
    case 'failed':
      return 'Com erro';
  }
}

function readableWorkspaceApprovalState(
  approvalState: WorkspaceAgentRunSnapshot['approvalState'],
): string {
  switch (approvalState) {
    case 'confirmed':
      return 'Confirmado';
    case 'missing_confirmation':
      return 'Sem confirmacao';
    case 'not_required':
      return 'Nao precisava';
  }
}

function readableWorkspaceChangeType(changeType: WorkspaceAgentRunSnapshot['fileDiffs'][number]['changeType']): string {
  switch (changeType) {
    case 'added':
      return 'Ficheiro novo';
    case 'deleted':
      return 'Ficheiro removido';
    case 'modified':
      return 'Ficheiro alterado';
  }
}

function toneForWorkspaceRun(run: WorkspaceAgentRunSnapshot): UiTone {
  if (run.executionState === 'rejected') {
    return 'warning';
  }

  switch (run.status) {
    case 'completed':
      return 'positive';
    case 'failed':
      return 'danger';
  }
}

function renderWorkspaceFileBadges(filePaths: readonly string[], tone: UiTone): string {
  if (filePaths.length === 0) {
    return renderUiBadge({
      label: 'Sem ficheiros',
      tone: 'neutral',
      style: 'chip',
    });
  }

  return filePaths
    .map((filePath) =>
      renderUiBadge({
        label: filePath,
        tone,
        style: 'chip',
      }),
    )
    .join('');
}

function shouldAutoRefreshRoute(route: string, topic: string): boolean {
  if (topic.startsWith('workspace.')) {
    return route === '/workspace';
  }

  if (topic.startsWith('assistant.schedule.')) {
    return route === '/assistant';
  }

  if (topic.startsWith('media.')) {
    return route === '/media' || route === '/whatsapp';
  }

  if (topic.startsWith('routing.') || topic.startsWith('instruction.')) {
    return route === '/assistant' || route === '/media' || route === '/distributions' || route === '/today';
  }

  if (topic.startsWith('schedules.')) {
    return route === '/assistant' || route === '/week' || route === '/today';
  }

  if (topic.startsWith('whatsapp.')) {
    return route === '/whatsapp' || route === '/today';
  }

  if (topic.startsWith('groups.') || topic.startsWith('people.')) {
    return route === '/whatsapp' || route === '/groups';
  }

  if (topic.startsWith('settings.whatsapp')) {
    return route === '/whatsapp' || route === '/settings' || route === '/migration' || route === '/today';
  }

  if (topic.startsWith('settings.codex_auth_router')) {
    return route === '/migration' || route === '/settings';
  }

  return false;
}

function buildWorkspacePeople(pageData: WhatsAppManagementPageData): readonly WorkspacePersonView[] {
  const merged = new Map<string, WorkspacePersonView>();
  const ownedGroupsByPersonId = new Map<string, string[]>();

  for (const group of pageData.workspace.groups) {
    for (const ownerPersonId of group.ownerPersonIds) {
      const current = ownedGroupsByPersonId.get(ownerPersonId) ?? [];
      current.push(group.groupJid);
      ownedGroupsByPersonId.set(ownerPersonId, current);
    }
  }

  const upsertPerson = (person: WorkspacePersonView): void => {
    const key = person.personId ?? `jid:${person.whatsappJids.join('|') || person.displayName}`;
    const current = merged.get(key);

    merged.set(key, {
      personId: person.personId ?? current?.personId ?? null,
      displayName: person.displayName || current?.displayName || 'Contacto sem nome',
      whatsappJids: dedupeStringList([...(current?.whatsappJids ?? []), ...person.whatsappJids]),
      globalRoles: dedupePersonRoles([...(current?.globalRoles ?? []), ...person.globalRoles]),
      privateAssistantAuthorized: current?.privateAssistantAuthorized || person.privateAssistantAuthorized,
      ownedGroupJids: dedupeStringList([...(current?.ownedGroupJids ?? []), ...person.ownedGroupJids]),
      knownToBot: current?.knownToBot || person.knownToBot,
    });
  };

  for (const person of pageData.people) {
    const whatsappJids = person.identifiers
      .filter((identifier) => identifier.kind === 'whatsapp_jid')
      .map((identifier) => identifier.value);

    upsertPerson({
      personId: person.personId,
      displayName: person.displayName,
      whatsappJids,
      globalRoles: person.globalRoles,
      privateAssistantAuthorized: false,
      ownedGroupJids: ownedGroupsByPersonId.get(person.personId) ?? [],
      knownToBot: whatsappJids.length > 0,
    });
  }

  for (const conversation of pageData.workspace.conversations) {
    upsertPerson({
      personId: conversation.personId,
      displayName: conversation.displayName,
      whatsappJids: conversation.whatsappJids,
      globalRoles: conversation.globalRoles,
      privateAssistantAuthorized: conversation.privateAssistantAuthorized,
      ownedGroupJids: conversation.ownedGroupJids,
      knownToBot: conversation.knownToBot,
    });
  }

  for (const appOwner of pageData.workspace.appOwners) {
    upsertPerson({
      personId: appOwner.personId,
      displayName: appOwner.displayName,
      whatsappJids: appOwner.whatsappJids,
      globalRoles: appOwner.globalRoles,
      privateAssistantAuthorized: appOwner.privateAssistantAuthorized,
      ownedGroupJids: appOwner.ownedGroupJids,
      knownToBot: appOwner.knownToBot,
    });
  }

  return [...merged.values()].sort((left, right) => {
    const leftWeight = left.globalRoles.includes('app_owner') ? 0 : 1;
    const rightWeight = right.globalRoles.includes('app_owner') ? 0 : 1;

    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    return left.displayName.localeCompare(right.displayName, 'pt-PT');
  });
}

function createEmptyGroupManagementDraft(): GroupManagementDraft {
  return {
    selectedGroupJid: null,
    instructions: '',
    previewText: 'A Aula 1 mudou?',
    selectedDocumentId: null,
    knowledgeDocument: createEmptyGroupKnowledgeDraft(),
  };
}

function createEmptyGroupKnowledgeDraft(): GroupKnowledgeDraft {
  return {
    documentId: '',
    filePath: '',
    title: '',
    summary: '',
    aliases: '',
    tags: '',
    enabled: 'enabled',
    content: '',
  };
}

function mapGroupKnowledgeDocumentToDraft(
  document: GroupIntelligenceSnapshot['knowledge']['documents'][number],
): GroupKnowledgeDraft {
  return {
    documentId: document.documentId,
    filePath: document.filePath,
    title: document.title,
    summary: document.summary ?? '',
    aliases: document.aliases.join(', '),
    tags: document.tags.join(', '),
    enabled: document.enabled ? 'enabled' : 'disabled',
    content: document.content ?? '',
  };
}

function parseCommaSeparatedValues(value: string): readonly string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function renderWhatsAppAclField(
  groupJid: string,
  scope: CalendarAccessScope,
  currentValue: CalendarAccessMode,
): string {
  const scopeLabel = readableCalendarScopeLabel(scope);
  return `
    <div class="acl-access-row acl-access-row--${escapeHtml(currentValue)}">
      <div class="acl-access-row__copy">
        <span class="acl-access-row__title">${escapeHtml(scopeLabel)}</span>
        <p class="acl-access-row__summary">${escapeHtml(describeCalendarScope(scope))}</p>
      </div>
      <select
        class="ui-control acl-access-row__select"
        aria-label="Nivel de acesso para ${escapeHtml(scopeLabel)}"
        data-whatsapp-acl-group-jid="${escapeHtml(groupJid)}"
        data-whatsapp-acl-scope="${escapeHtml(scope)}"
      >
        <option value="read"${currentValue === 'read' ? ' selected' : ''}>So ver</option>
        <option value="read_write"${currentValue === 'read_write' ? ' selected' : ''}>Pode editar</option>
      </select>
    </div>
  `;
}

function resolveAuthorizedGroupJids(snapshot: WhatsAppWorkspaceSnapshot): string[] {
  if (!snapshot.settings.commands.assistantEnabled) {
    return [];
  }

  if (snapshot.settings.commands.authorizedGroupJids.length === 0) {
    return snapshot.groups.map((group) => group.groupJid);
  }

  return dedupeStringList(snapshot.settings.commands.authorizedGroupJids);
}

function readRouteGroupOptions(
  page: UiPage | null,
  assistantRailGroups: readonly Group[],
): ShellGroupSwitcherState['groups'] {
  if (page && page.route === '/groups') {
    return (page as UiPage<GroupManagementPageData>).data.groups.map((group) => ({
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
    }));
  }

  if (page && page.route === '/assistant') {
    return (page as UiPage<AssistantPageData>).data.groups.map((group) => ({
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
    }));
  }

  if (page && page.route === '/media') {
    return (page as UiPage<MediaLibraryPageData>).data.groups.map((group) => ({
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
    }));
  }

  if (page && page.route === '/week') {
    return (page as UiPage<WeekPlannerSnapshot>).data.groups.map((group) => ({
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
    }));
  }

  if (page && page.route === '/whatsapp') {
    return (page as UiPage<WhatsAppManagementPageData>).data.workspace.groups.map((group) => ({
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
    }));
  }

  return assistantRailGroups.map((group) => ({
    groupJid: group.groupJid,
    preferredSubject: group.preferredSubject,
  }));
}

function resolveAuthorizedGroupJidsForCommands(
  groups: readonly Group[],
  commands: SettingsSnapshot['adminSettings']['commands'],
): string[] {
  if (!commands.assistantEnabled) {
    return [];
  }

  if (commands.authorizedGroupJids.length === 0) {
    return groups.map((group) => group.groupJid);
  }

  return dedupeStringList(commands.authorizedGroupJids);
}

function isGroupMode(value: string): value is Group['operationalSettings']['mode'] {
  return value === 'com_agendamento' || value === 'distribuicao_apenas';
}

function isGroupMemberTagPolicy(value: string): value is Group['operationalSettings']['memberTagPolicy'] {
  return value === 'members_can_tag' || value === 'owner_only';
}

function resolvePersonDisplayName(personId: string, people: readonly Person[]): string {
  return people.find((person) => person.personId === personId)?.displayName ?? personId.replace(/^person-/u, '');
}

function describeGroupOwners(group: Group, people: readonly Person[]): string {
  if (group.groupOwners.length === 0) {
    return 'Sem responsavel definido';
  }

  return `Responsavel: ${group.groupOwners.map((owner) => resolvePersonDisplayName(owner.personId, people)).join(', ')}`;
}

function buildGroupOwnerOptions(
  group: Group,
  people: readonly Person[],
): readonly {
  readonly value: string;
  readonly label: string;
}[] {
  const options = new Map<string, string>();
  options.set('', 'Sem responsavel');

  for (const person of people) {
    options.set(person.personId, person.displayName);
  }

  for (const owner of group.groupOwners) {
    if (!options.has(owner.personId)) {
      options.set(owner.personId, resolvePersonDisplayName(owner.personId, people));
    }
  }

  return [...options.entries()].map(([value, label]) => ({
    value,
    label,
  }));
}

function readableGroupMode(mode: Group['operationalSettings']['mode']): string {
  return mode === 'com_agendamento' ? 'Com agendamento' : 'Distribuicao apenas';
}

function toneForGroupMode(mode: Group['operationalSettings']['mode']): UiTone {
  return mode === 'com_agendamento' ? 'positive' : 'warning';
}

function readableGroupMemberTagPolicy(policy: Group['operationalSettings']['memberTagPolicy']): string {
  return policy === 'members_can_tag' ? 'Membros podem tagar' : 'So o owner pode tagar';
}

function describeGroupMode(
  mode: Group['operationalSettings']['mode'],
  allowLlmScheduling: boolean,
): string {
  if (mode === 'com_agendamento') {
    return allowLlmScheduling
      ? 'Este grupo esta preparado para pedidos assistidos de scheduling, com apoio da LLM quando fizer sentido.'
      : 'Este grupo continua com agendamento ativo, mas a LLM nao toma decisoes de scheduling neste momento.';
  }

  return 'Este grupo funciona como destino de distribuicao: o foco passa a ser fan-out e nao agendamento local.';
}

function resolveAuthorizedPrivateJids(snapshot: WhatsAppWorkspaceSnapshot): string[] {
  if (!snapshot.settings.commands.assistantEnabled || !snapshot.settings.commands.allowPrivateAssistant) {
    return [];
  }

  if (snapshot.settings.commands.authorizedPrivateJids.length === 0) {
    return dedupeStringList(snapshot.conversations.flatMap((conversation) => conversation.whatsappJids));
  }

  return dedupeStringList(snapshot.settings.commands.authorizedPrivateJids);
}

function isCalendarAccessScope(value: string): value is CalendarAccessScope {
  return value === 'group' || value === 'groupOwner' || value === 'appOwner';
}

function isCalendarAccessMode(value: string): value is CalendarAccessMode {
  return value === 'read' || value === 'read_write';
}

function readableCalendarAccessMode(value: CalendarAccessMode): string {
  return value === 'read_write' ? 'ver e editar' : 'so ver';
}

function readableCalendarScopeLabel(scope: CalendarAccessScope): string {
  switch (scope) {
    case 'group':
      return 'Membros';
    case 'groupOwner':
      return 'Responsavel';
    case 'appOwner':
      return 'Admin da app';
  }
}

function readableMediaType(mediaType: MediaAssetSnapshot['mediaType']): string {
  switch (mediaType) {
    case 'video':
      return 'Video';
    case 'image':
      return 'Imagem';
    case 'document':
      return 'Documento';
    case 'audio':
      return 'Audio';
    default:
      return 'Media';
  }
}

function readMediaInstructionPayload(
  instruction: Instruction,
): { readonly assetId: string; readonly caption: string | null } | null {
  const payload = instruction.actions.find((action) => {
    const candidate = action.payload as { readonly kind?: unknown } | undefined;
    return candidate?.kind === 'media';
  })?.payload as
    | {
        readonly kind?: unknown;
        readonly assetId?: unknown;
        readonly caption?: unknown;
      }
    | undefined;

  if (payload?.kind !== 'media' || typeof payload.assetId !== 'string' || !payload.assetId.trim()) {
    return null;
  }

  return {
    assetId: payload.assetId.trim(),
    caption: typeof payload.caption === 'string' && payload.caption.trim() ? payload.caption.trim() : null,
  };
}

function readableInstructionActionStatus(status: Instruction['actions'][number]['status']): string {
  switch (status) {
    case 'pending':
      return 'pendente';
    case 'running':
      return 'a enviar';
    case 'completed':
      return 'entregue';
    case 'failed':
      return 'falhou';
    case 'skipped':
      return 'ignorado';
  }
}

function toneForMediaType(mediaType: MediaAssetSnapshot['mediaType']): UiTone {
  switch (mediaType) {
    case 'video':
      return 'positive';
    case 'document':
      return 'warning';
    case 'image':
      return 'neutral';
    case 'audio':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function readableSourceChat(chatJid: string): string {
  return chatJid.endsWith('@g.us') ? `Grupo ${chatJid}` : `Privado ${chatJid}`;
}

function formatFileSize(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

function describeCalendarScope(scope: CalendarAccessScope): string {
  switch (scope) {
    case 'group':
      return 'Pessoas normais deste grupo.';
    case 'groupOwner':
      return 'Responsavel local por este grupo.';
    case 'appOwner':
      return 'Controlo global da aplicacao.';
  }
}

function dedupeStringList(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right, 'pt-PT'),
  );
}

function dedupePersonRoles(values: readonly PersonRole[]): PersonRole[] {
  return [...new Set(values)];
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function summarizeTelemetryMessage(message: string): string {
  return message.replace(/\s+/gu, ' ').trim().slice(0, 140);
}

function readStoredAdvancedDetailsPreference(): boolean {
  try {
    return window.localStorage.getItem(ADVANCED_DETAILS_STORAGE_KEY) === 'advanced';
  } catch {
    return false;
  }
}

function writeStoredAdvancedDetailsPreference(enabled: boolean): void {
  try {
    if (enabled) {
      window.localStorage.setItem(ADVANCED_DETAILS_STORAGE_KEY, 'advanced');
      return;
    }

    window.localStorage.removeItem(ADVANCED_DETAILS_STORAGE_KEY);
  } catch {}
}

function readStoredUxTelemetry(): readonly UxTelemetryEntry[] {
  try {
    const raw = window.localStorage.getItem(UX_TELEMETRY_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as readonly UxTelemetryEntry[];
    return parsed.slice(0, 8);
  } catch {
    return [];
  }
}

function writeStoredUxTelemetry(entries: readonly UxTelemetryEntry[]): void {
  try {
    window.localStorage.setItem(UX_TELEMETRY_STORAGE_KEY, JSON.stringify(entries.slice(0, 8)));
  } catch {}
}

function renderScreenStateLabel(screenState: ScreenState): string {
  switch (screenState) {
    case 'ready':
      return 'Conteudo pronto';
    case 'loading':
      return 'A carregar';
    case 'empty':
      return 'Sem dados';
    case 'offline':
      return 'Sem ligacao';
    case 'error':
      return 'Com erro';
  }
}

function toneFromScreenState(screenState: ScreenState): UiTone {
  switch (screenState) {
    case 'ready':
      return 'positive';
    case 'loading':
    case 'empty':
      return 'warning';
    case 'offline':
    case 'error':
      return 'danger';
  }
}

function toneFromHealth(status: DashboardSnapshot['health']['status']): UiTone {
  switch (status) {
    case 'healthy':
      return 'positive';
    case 'starting':
      return 'warning';
    case 'degraded':
      return 'danger';
    case 'stopped':
      return 'danger';
  }
}

function toneFromDistribution(status: DistributionSummary['status']): UiTone {
  switch (status) {
    case 'completed':
      return 'positive';
    case 'queued':
    case 'running':
    case 'partial_failed':
      return 'warning';
    case 'failed':
      return 'danger';
  }
}

function formatShortDateTime(value: string | null): string {
  if (!value) {
    return 'agora';
  }

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function looksOffline(message: string): boolean {
  const value = message.toLowerCase();
  return value.includes('failed to fetch') || value.includes('network') || value.includes('503') || value.includes('offline');
}
