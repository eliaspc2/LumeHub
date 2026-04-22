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
  GroupReminderPolicySnapshot,
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
  WeeklyPlannerSnapshot as WeekPlannerSnapshot,
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
import type { FrontendTransportMode } from '../app/BrowserTransportFactory.js';
import type {
  AssistantPageData,
  AppRouter,
  CodexRouterPageData,
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

type ReminderTimingMode = 'relative_before_event' | 'fixed_previous_day' | 'fixed_same_day' | 'relative_after_event';

interface GroupReminderDraft {
  readonly reminderId: string;
  readonly enabled: boolean;
  readonly label: string;
  readonly timingMode: ReminderTimingMode;
  readonly offsetMinutes: string;
  readonly localTime: string;
  readonly messageTemplate: string;
  readonly llmPromptTemplate: string;
}

interface GroupReminderPolicyDraft {
  readonly enabled: boolean;
  readonly reminders: readonly GroupReminderDraft[];
}

interface GroupManagementDraft {
  readonly selectedGroupJid: string | null;
  readonly instructions: string;
  readonly previewText: string;
  readonly reminderPolicy: GroupReminderPolicyDraft;
  readonly selectedDocumentId: string | null;
  readonly knowledgeDocument: GroupKnowledgeDraft;
}

type GroupPermissionSource = Pick<Group, 'calendarAccessPolicy' | 'operationalSettings'> & {
  readonly assistantAuthorized: boolean;
};

type ProductCommandSettingKey =
  | 'assistantEnabled'
  | 'schedulingEnabled'
  | 'autoReplyEnabled'
  | 'directRepliesEnabled'
  | 'allowPrivateAssistant'
  | 'ownerTerminalEnabled';

type ProductLlmSettingKey = 'enabled' | 'streamingEnabled';
type ProductPowerMode = 'allow_sleep' | 'on_demand' | 'always_inhibit';

const PRODUCT_COMMAND_SETTING_KEYS: readonly ProductCommandSettingKey[] = [
  'assistantEnabled',
  'schedulingEnabled',
  'autoReplyEnabled',
  'directRepliesEnabled',
  'allowPrivateAssistant',
  'ownerTerminalEnabled',
];

const PRODUCT_LLM_SETTING_KEYS: readonly ProductLlmSettingKey[] = ['enabled', 'streamingEnabled'];
const PRODUCT_POWER_MODES: readonly ProductPowerMode[] = ['allow_sleep', 'on_demand', 'always_inhibit'];

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

interface FocusedFieldSnapshot {
  readonly fieldKey: string;
  readonly fieldIndex: number;
  readonly selectionStart: number | null;
  readonly selectionEnd: number | null;
  readonly selectionDirection: 'forward' | 'backward' | 'none' | null;
  readonly scrollTop: number;
  readonly scrollLeft: number;
}

interface ShellGroupSwitcherState {
  readonly groups: readonly {
    readonly groupJid: string;
    readonly preferredSubject: string;
  }[];
  readonly selectedGroupJid: string;
  readonly selectedLabel: string;
}

interface OperationalGroupLike {
  readonly groupJid: string;
  readonly preferredSubject: string;
  readonly operationalSettings: {
    readonly mode: 'com_agendamento' | 'distribuicao_apenas';
    readonly schedulingEnabled: boolean;
    readonly allowLlmScheduling: boolean;
    readonly memberTagPolicy: 'members_can_tag' | 'owner_only';
  };
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
      this.recordUxEvent('warning', `Grupos do chat de apoio indisponiveis: ${summarizeTelemetryMessage(readErrorMessage(error))}.`);
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
    const chatIntent = currentRoute.canonicalRoute === '/assistant' ? 'direct_ui_chat' : 'sidebar_ui_chat';
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
          intent: chatIntent === 'direct_ui_chat' ? 'direct_group_chat' : 'sidebar_group_chat',
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
        intent: chatIntent,
        contextSummary,
        domainFacts: [
          'Contexto global do operador. Nao assumir um grupo WhatsApp especifico, a nao ser que o utilizador o indique explicitamente.',
        ],
        memoryScope: {
          scope: 'none',
          groupJid: null,
          groupLabel: null,
          instructionsSource: null,
          instructionsApplied: false,
          knowledgeSnippetCount: 0,
          knowledgeDocuments: [],
        },
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

    if (page.route === '/migration') {
      this.syncSettingsDrafts(page as UiPage<MigrationPageData>);
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
        reminderPolicy: mapReminderPolicySnapshotToDraft(intelligence?.policy ?? null),
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
    const railGroups = page.data.groups.length > 0 ? page.data.groups : this.state.assistantRailChat.availableGroups;
    const selectedRailGroupJid = resolveAssistantRailSelectedGroupJid(
      this.state.assistantRailChat.selectedGroupJid,
      railGroups,
      selectedGroupJid,
    );

    this.state = {
      ...this.state,
      assistantSchedulingDraft: {
        ...this.state.assistantSchedulingDraft,
        groupJid: selectedGroupJid,
      },
      assistantRailChat: {
        ...this.state.assistantRailChat,
        availableGroups: railGroups,
        selectedGroupJid: selectedRailGroupJid,
      },
    };
  }

  private syncSettingsDrafts(page: UiPage<MigrationPageData>): void {
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

    if (currentRoute.canonicalRoute === '/week' || currentRoute.canonicalRoute === '/assistant') {
      return null;
    }

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
    const focusedFieldSnapshot = this.captureFocusedFieldSnapshot();

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
    this.restoreFocusedFieldSnapshot(focusedFieldSnapshot);
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

  private shouldRenderAssistantRail(_currentRoute: ResolvedAppRoute): boolean {
    return false;
  }

  private renderMainContent(currentRoute: ResolvedAppRoute): string {
    if (this.state.screenState === 'loading') {
      return this.renderLoadingStateCard(currentRoute);
    }

    if (this.state.screenState === 'offline') {
      return this.renderStateCard(
        'Nao conseguimos ligar a esta instalacao do LumeHub',
        'Tentamos abrir os dados live desta pagina, mas a ligacao ao backend nao respondeu. Podes tentar outra vez ou abrir o demo enquanto a ligacao volta.',
        [
          { label: 'Tentar outra vez', value: 'none', kind: 'preview' },
          { label: 'Abrir demo', value: 'demo', kind: 'mode' },
        ],
        'Ligacao',
      );
    }

    if (this.state.screenState === 'error') {
      return this.renderStateCard(
        'Esta pagina nao abriu como era suposto',
        `A pagina ${currentRoute.label} respondeu com erro nesta carga. Podes tentar novamente ou voltar a Hoje para seguir por outro caminho.`,
        [
          { label: 'Tentar outra vez', value: 'none', kind: 'preview' },
          { label: 'Voltar a Hoje', value: '/today', kind: 'route' },
        ],
        'Recuperacao',
      );
    }

    if (this.state.screenState === 'empty') {
      return this.renderStateCard(
        currentRoute.canonicalRoute === '/today' ? 'Ainda nao ha nada urgente para mostrar' : `${currentRoute.label} ainda nao tem dados para mostrar`,
        currentRoute.canonicalRoute === '/today'
          ? 'A homepage abriu bem, mas esta instalacao ainda nao gerou atividade suficiente para preencher este resumo.'
          : `A pagina ${currentRoute.label} abriu bem, mas ainda nao recebeu dados suficientes desta instalacao.`,
        currentRoute.canonicalRoute === '/today' ? [] : [{ label: 'Voltar a Hoje', value: '/today', kind: 'route' }],
        'Sem dados',
      );
    }

    if (!this.state.page) {
      return this.renderLoadingStateCard(currentRoute);
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
      case '/codex-router':
        return this.renderCodexRouterPage(this.state.page as UiPage<CodexRouterPageData>);
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
        ? 'Comeca pelos problemas que o sistema encontrou e confirmou.'
        : snapshot.whatsapp.phase !== 'open'
          ? 'Abre o WhatsApp e confirma a ligacao antes de continuares.'
          : snapshot.distributions.running + snapshot.distributions.queued > 0
            ? 'Confirma os envios em curso antes de preparares novos.'
            : 'Abre a agenda da semana e prepara o proximo agendamento.';

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Entrada principal</p>
          <h2>Ves em poucos segundos se esta tudo bem e o que fazer a seguir.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({ label: 'Ver agenda', href: '/week', dataAttributes: { route: '/week' } })}
            ${renderUiActionButton({ label: 'Ver WhatsApp', href: '/whatsapp', variant: 'secondary', dataAttributes: { route: '/whatsapp' } })}
            ${renderUiActionButton({ label: 'Ver grupos', href: '/groups', variant: 'secondary', dataAttributes: { route: '/groups' } })}
          </div>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Pronto para operar',
            badgeLabel: snapshot.readiness.ready ? 'Pronto' : 'Rever',
            badgeTone: readyTone,
            contentHtml: `<p>${escapeHtml(
              snapshot.readiness.ready
                ? 'O sistema parece utilizavel e a ligacao local responde bem.'
                : 'Ainda ha sinais a rever antes de confiares plenamente na operacao.',
            )}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Proximo passo recomendado',
            contentHtml: `<p>${escapeHtml(nextStep)}</p>`,
          })}
        </div>
      </section>

      <section class="card-grid">
        ${renderUiMetricCard({ title: 'WhatsApp pronto', value: readableSessionPhase(snapshot.whatsapp.phase), tone: toneForSessionPhase(snapshot.whatsapp.phase), description: 'Ligacao atual do WhatsApp.' })}
        ${renderUiMetricCard({ title: 'Problemas ativos', value: String(snapshot.watchdog.openIssues), tone: snapshot.watchdog.openIssues > 0 ? 'warning' : 'positive', description: 'Pontos que merecem atencao agora.' })}
        ${renderUiMetricCard({ title: 'Envios em curso', value: String(snapshot.distributions.running + snapshot.distributions.queued), tone: snapshot.distributions.running > 0 ? 'warning' : 'neutral', description: 'Envios a decorrer ou a aguardar.' })}
        ${renderUiMetricCard({ title: 'Grupos prontos', value: `${snapshot.groups.withOwners}/${snapshot.groups.total}`, tone: 'neutral', description: 'Grupos com responsavel definido.' })}
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
                : '<li>Sem problemas abertos neste momento.</li>'
            }
            <li>${snapshot.distributions.queued} envios em fila e ${snapshot.distributions.running} a decorrer.</li>
            <li>${snapshot.distributions.partialFailed} com falha parcial e ${snapshot.distributions.failed} falhados.</li>
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
              bodyHtml: `<div class="action-row">${renderUiActionButton({ label: 'Ver agenda', href: '/week', dataAttributes: { route: '/week' } })}</div>`,
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
        </div>
      </details>
    `;
  }

  private renderWeekPage(page: UiPage<WeekPlannerSnapshot>): string {
    const groups = page.data.groups;
    const schedulableGroups = groups.filter((group) => canGroupUseManualScheduling(group));
    const llmDisabledGroups = groups.filter((group) => canGroupUseManualScheduling(group) && !canGroupUseLlmScheduling(group));
    const distributionGroups = groups.filter((group) => !canGroupUseManualScheduling(group));
    const draft = resolveScheduleDraft(this.state.scheduleDraft, schedulableGroups.length > 0 ? schedulableGroups : groups);
    const selectedGroup = groups.find((group) => group.groupJid === draft.groupJid) ?? null;
    const editingEvent = page.data.events.find((event) => event.eventId === draft.eventId) ?? null;
    const groupsByJid = new Map(groups.map((group) => [group.groupJid, group]));
    const weekDays = buildWeekCalendarDays(page.data);
    const occupiedDays = weekDays.filter((day) => day.events.length > 0).length;
    const busiestDay = weekDays.reduce<WeekCalendarDayView | null>(
      (best, day) => (!best || day.events.length > best.events.length ? day : best),
      null,
    );
    const sortedEvents = page.data.events
      .slice()
      .sort(
        (left, right) =>
          left.localDate.localeCompare(right.localDate) ||
          left.startTime.localeCompare(right.startTime) ||
          left.title.localeCompare(right.title) ||
          left.eventId.localeCompare(right.eventId),
      );
    const nextEvent = sortedEvents[0] ?? null;
    const focusedDay =
      weekDays.find((day) => day.dayLabel === (editingEvent?.dayLabel ?? draft.dayLabel)) ??
      (nextEvent ? weekDays.find((day) => day.events.some((event) => event.eventId === nextEvent.eventId)) : null) ??
      weekDays.find((day) => day.events.length > 0) ??
      weekDays[0] ??
      null;
    const focusedEvent = editingEvent ?? focusedDay?.events[0] ?? nextEvent ?? null;
    const summaryDays = weekDays
      .filter(
        (day) =>
          day.events.length > 0 ||
          day.notifications.pendingNotifications > 0 ||
          day.notifications.waitingConfirmationNotifications > 0,
      )
      .slice(0, 4);
    const canSaveSchedule = Boolean(selectedGroup && canGroupUseManualScheduling(selectedGroup));
    const weekSecondaryActionHref =
      selectedGroup && canGroupUseLlmScheduling(selectedGroup)
        ? '/assistant'
        : selectedGroup && canGroupUseManualScheduling(selectedGroup)
          ? '/week'
          : '/distributions';
    const weekSecondaryActionLabel =
      selectedGroup && canGroupUseLlmScheduling(selectedGroup)
        ? 'Assistente LLM'
        : selectedGroup && canGroupUseManualScheduling(selectedGroup)
          ? 'Calendario manual'
          : 'Abrir distribuicoes';
    const notificationLabels = page.data.defaultNotificationRuleLabels.length > 0
      ? page.data.defaultNotificationRuleLabels
      : ['24h antes', '30 min antes'];
    const weekHeadline = nextEvent
      ? `Proximo evento: ${nextEvent.title} em ${formatWeekEventMoment(nextEvent)}.`
      : 'Ainda nao ha eventos planeados nesta semana.';
    const nextStepSummary =
      page.data.diagnostics.eventCount === 0
        ? 'Escolhe um grupo com agenda ativa e cria o primeiro evento desta semana.'
        : page.data.diagnostics.waitingConfirmationNotifications > 0
          ? 'Confirma primeiro o que ainda esta a aguardar validacao antes de criares mais.'
          : llmDisabledGroups.length > 0
            ? `${llmDisabledGroups.length} grupo(s) continuam com agenda manual sem ajuda da LLM.`
            : 'A leitura rapida ja chega para decidir o proximo passo. Abre a grelha completa so quando precisares de comparar dias.';
    const examples = schedulableGroups.slice(0, 3).map((group, index) => ({
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
          <p class="eyebrow">Calendario operacional</p>
          <h2>Primeiro ves a semana em resumo. A grelha completa fica abaixo so para quando precisares de detalhe.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({
              label: editingEvent ? 'Guardar alteracoes' : 'Criar evento',
              disabled: !canSaveSchedule,
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
            badgeLabel: `${schedulableGroups.length} grupo(s) com agenda`,
            badgeTone: 'neutral',
            contentHtml: `<p>${escapeHtml(
              `${page.data.focusWeekRangeLabel}. Timezone ${page.data.timezone}. ${distributionGroups.length} grupo(s) desta ronda seguem apenas em distribuicao.`,
            )}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Proximo passo',
            badgeLabel: occupiedDays > 0 ? `${occupiedDays} dia(s) com agenda` : 'Semana vazia',
            badgeTone: page.data.diagnostics.eventCount > 0 ? 'positive' : 'neutral',
            contentHtml: `<p>${escapeHtml(
              `${weekHeadline} ${
                occupiedDays > 0
                  ? `O dia mais cheio e ${busiestDay?.label ?? 'sem dia dominante'} com ${busiestDay?.events.length ?? 0} evento(s).`
                  : 'Ainda nao ha nenhum dia ocupado.'
              }`,
            )}</p>`,
          })}
        </div>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-8">
          <div class="card-header">
            <div>
              <h3>Leitura rapida da semana</h3>
              <p class="week-section-note">Resumo curto para perceber o estado da agenda sem abrir logo a grelha completa.</p>
            </div>
            ${renderUiBadge({
              label: occupiedDays > 0 ? `${occupiedDays} dia(s) com agenda` : 'Semana vazia',
              tone: occupiedDays > 0 ? 'positive' : 'neutral',
            })}
          </div>
          <div class="card-grid">
            ${renderUiRecordCard({
              title: 'Semana em foco',
              subtitle: weekHeadline,
              badgeLabel: page.data.focusWeekLabel,
              badgeTone: page.data.diagnostics.eventCount > 0 ? 'positive' : 'neutral',
              bodyHtml: `<p>${escapeHtml(
                `${schedulableGroups.length} grupo(s) com agenda local. ${distributionGroups.length} grupo(s) fora da agenda local. ${describeWeekNotificationMix({
                  pending: page.data.diagnostics.pendingNotifications,
                  waitingConfirmation: page.data.diagnostics.waitingConfirmationNotifications,
                  sent: page.data.diagnostics.sentNotifications,
                })}`,
              )}</p>`,
            })}
            ${renderUiRecordCard({
              title: 'Proximo passo',
              subtitle: nextStepSummary,
              badgeLabel: canSaveSchedule ? 'Pode agir' : 'A rever',
              badgeTone: canSaveSchedule ? 'positive' : 'warning',
              bodyHtml: `<div class="action-row">${renderUiActionButton({
                label: selectedGroup ? 'Continuar no editor' : 'Escolher grupo',
                variant: 'secondary',
                dataAttributes: { 'flow-action': focusedDay ? 'schedule-compose-day' : 'schedule-clear', 'flow-value': focusedDay?.dayLabel },
              })}</div>`,
            })}
            ${renderUiRecordCard({
              title: nextEvent ? nextEvent.title : 'Semana ainda vazia',
              subtitle: nextEvent ? `${nextEvent.groupLabel} · ${formatWeekEventMoment(nextEvent)}` : 'Ainda nao existe um evento de referencia nesta semana.',
              badgeLabel: nextEvent ? 'Proximo evento' : 'Sem evento',
              badgeTone: nextEvent ? 'positive' : 'neutral',
              bodyHtml: `<p>${escapeHtml(
                nextEvent
                  ? `${describeWeekNotificationMix({
                      pending: nextEvent.notifications.pending,
                      waitingConfirmation: nextEvent.notifications.waitingConfirmation,
                      sent: nextEvent.notifications.sent,
                    })}.`
                  : 'Quando criares o primeiro evento, ele passa a aparecer aqui como referencia rapida.',
              )}</p>`,
            })}
            ${renderUiRecordCard({
              title: distributionGroups.length > 0 ? 'Grupos fora da agenda' : 'Todos na agenda local',
              subtitle:
                distributionGroups.length > 0
                  ? distributionGroups.map((group) => group.preferredSubject).join(', ')
                  : 'Todos os grupos desta vista continuam a aceitar agenda local.',
              badgeLabel: distributionGroups.length > 0 ? `${distributionGroups.length} grupo(s)` : 'Sem desvios',
              badgeTone: distributionGroups.length > 0 ? 'warning' : 'positive',
              bodyHtml: `<p>${escapeHtml(
                distributionGroups.length > 0
                  ? 'Estes grupos seguem so por distribuicao. Nao aparecem como editaveis no editor semanal.'
                  : 'Podes trabalhar a semana inteira sem sair desta pagina.',
              )}</p>`,
            })}
          </div>
          <div class="week-editor__section">
            <div class="summary-column__header">
              <h4>Dias para rever</h4>
              <p>Abre um dia ou um evento em foco antes de entrares na grelha completa.</p>
            </div>
            ${
              summaryDays.length > 0
                ? `
                  <div class="compact-record-list">
                    ${summaryDays
                      .map(
                        (day) =>
                          renderUiRecordCard({
                            title: day.label,
                            subtitle: describeWeekDaySummary(day),
                            badgeLabel: day.events.length > 0 ? `${day.events.length} evento(s)` : 'Sem evento',
                            badgeTone: day.events.length > 0 ? 'positive' : 'neutral',
                            bodyHtml: `
                              <p>${escapeHtml(
                                day.events[0]
                                  ? `Primeiro evento: ${day.events[0].title} em ${day.events[0].startTime}.`
                                  : 'Ainda nao existe um evento de referencia neste dia.',
                              )}</p>
                              <div class="action-row">
                                ${renderUiActionButton({
                                  label: 'Abrir este dia',
                                  variant: 'secondary',
                                  dataAttributes: {
                                    'flow-action': 'schedule-compose-day',
                                    'flow-value': day.dayLabel,
                                  },
                                })}
                                ${
                                  day.events[0]
                                    ? renderUiActionButton({
                                        label: 'Abrir primeiro evento',
                                        variant: 'secondary',
                                        dataAttributes: {
                                          'flow-action': 'schedule-load-event',
                                          'flow-value': day.events[0].eventId,
                                        },
                                      })
                                    : ''
                                }
                              </div>
                            `,
                          }),
                      )
                      .join('')}
                  </div>
                `
                : `
                  <div class="inline-empty">
                    <strong>Sem dias a pedir atencao</strong>
                    <p>A semana ainda nao tem eventos. Usa o editor abaixo para criar o primeiro.</p>
                  </div>
                `
            }
          </div>
        </article>

        <article class="surface content-card span-4">
          <div class="card-header">
            <div>
              <h3>Dia ou evento em foco</h3>
              <p class="week-section-note">Painel lateral para abrir o detalhe que interessa agora.</p>
            </div>
            ${renderUiBadge({
              label: focusedDay?.label ?? 'Sem foco',
              tone: focusedEvent ? 'positive' : 'neutral',
            })}
          </div>
          ${
            focusedEvent
              ? `
                <div class="guide-preview">
                  <p><strong>Evento</strong>: ${escapeHtml(focusedEvent.title)}</p>
                  <p><strong>Quando</strong>: ${escapeHtml(formatWeekEventMoment(focusedEvent))}</p>
                  <p><strong>Grupo</strong>: ${escapeHtml(focusedEvent.groupLabel)}</p>
                  <p><strong>Estado</strong>: ${escapeHtml(
                    describeWeekNotificationMix({
                      pending: focusedEvent.notifications.pending,
                      waitingConfirmation: focusedEvent.notifications.waitingConfirmation,
                      sent: focusedEvent.notifications.sent,
                    }),
                  )}</p>
                  <p><strong>Proximo lembrete</strong>: ${escapeHtml(
                    focusedEvent.nextReminderAt
                      ? `${focusedEvent.nextReminderLabel ?? 'sem etiqueta'} em ${formatShortDateTime(focusedEvent.nextReminderAt)}`
                      : 'Sem disparo futuro planeado.',
                  )}</p>
                  <p><strong>Notas</strong>: ${escapeHtml(focusedEvent.notes || 'Sem nota interna.')}</p>
                </div>
                <div class="action-row">
                  ${renderUiActionButton({
                    label: 'Abrir no editor',
                    variant: 'secondary',
                    dataAttributes: {
                      'flow-action': 'schedule-load-event',
                      'flow-value': focusedEvent.eventId,
                    },
                  })}
                  ${renderUiActionButton({
                    label: 'Abrir grupo',
                    href: `/groups/${encodeURIComponent(focusedEvent.groupJid)}`,
                    variant: 'secondary',
                    dataAttributes: { route: `/groups/${encodeURIComponent(focusedEvent.groupJid)}` },
                  })}
                </div>
              `
              : focusedDay
                ? `
                  <div class="guide-preview">
                    <p><strong>Dia</strong>: ${escapeHtml(focusedDay.label)}</p>
                    <p><strong>Resumo</strong>: ${escapeHtml(describeWeekDaySummary(focusedDay))}</p>
                    <p><strong>Proximo passo</strong>: ${
                      schedulableGroups.length > 0
                        ? 'Abrir o editor ja neste dia e preencher os detalhes.'
                        : 'Primeiro reativa um grupo com agenda local.'
                    }</p>
                  </div>
                  <div class="action-row">
                    ${renderUiActionButton({
                      label: 'Criar neste dia',
                      variant: 'secondary',
                      disabled: schedulableGroups.length === 0,
                      dataAttributes: {
                        'flow-action': 'schedule-compose-day',
                        'flow-value': focusedDay.dayLabel,
                      },
                    })}
                  </div>
                `
                : `
                  <div class="inline-empty">
                    <strong>Sem detalhe em foco</strong>
                    <p>Assim que houver um dia ou evento relevante, ele aparece aqui.</p>
                  </div>
                `
          }
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-7">
          <div class="card-header">
            <h3>${editingEvent ? 'Editar evento' : 'Criar ou ajustar'}</h3>
            ${renderUiBadge({
              label:
                editingEvent
                  ? 'Edicao live'
                  : selectedGroup
                    ? `${readableGroupMode(selectedGroup.operationalSettings.mode)}`
                    : 'Sem grupo elegivel',
              tone: canSaveSchedule ? 'positive' : 'warning',
            })}
          </div>
          <div class="week-editor" data-week-editor>
            ${
              schedulableGroups.length > 0
                ? `
                  <div class="ui-form-grid">
                    ${renderUiSelectField({
                      label: 'Grupo',
                      value: draft.groupJid,
                      dataKey: 'schedule.groupJid',
                      options: schedulableGroups.map((group) => ({
                        value: group.groupJid,
                        label: group.preferredSubject,
                      })),
                      hint: 'So aparecem aqui grupos com calendario local ativo.',
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
                      hint: 'Serve para rever rapidamente a intencao no detalhe do evento.',
                    })}
                  </div>
                `
                : `
                  <div class="timeline-item timeline-item--warning">
                    <strong>Sem grupos com agendamento ativo</strong>
                    <p>Todos os grupos desta ronda estao fora da agenda local ou com scheduling desligado. Reativa um grupo na pagina de grupo para voltar a usar o calendario semanal.</p>
                  </div>
                `
            }
            <div class="week-editor__summary">
              <p><strong>Grupo</strong>: ${escapeHtml(selectedGroup?.preferredSubject ?? 'Escolhe um grupo')}</p>
              <p><strong>Quando</strong>: ${escapeHtml(`${readableWeekDayLabel(draft.dayLabel)}, ${draft.startTime}`)}</p>
              <p><strong>Duracao</strong>: ${escapeHtml(`${draft.durationMinutes} minutos`)}</p>
              <p><strong>Modo</strong>: ${escapeHtml(selectedGroup ? describeManualSchedulingState(selectedGroup) : 'Sem grupo selecionado.')}</p>
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
              <div class="action-row">
                ${renderUiActionButton({
                  label: 'Abrir grupo',
                  href: selectedGroup ? `/groups/${encodeURIComponent(selectedGroup.groupJid)}` : '/groups',
                  variant: 'secondary',
                  dataAttributes: {
                    route: selectedGroup ? `/groups/${encodeURIComponent(selectedGroup.groupJid)}` : '/groups',
                  },
                })}
                ${renderUiActionButton({
                  label: weekSecondaryActionLabel,
                  href: weekSecondaryActionHref,
                  variant: 'secondary',
                  dataAttributes: {
                    route: weekSecondaryActionHref,
                  },
                })}
              </div>
            </div>
          </div>
        </article>

        <article class="surface content-card span-5">
          <div class="card-header">
            <h3>Criar mais depressa</h3>
            ${renderUiBadge({ label: 'Apoio curto', tone: 'positive' })}
          </div>
          <div class="week-editor">
            <div class="week-editor__section">
              <p class="week-section-note">Bases rapidas para preencher o editor sem escrever tudo de raiz.</p>
              ${
                examples.length > 0
                  ? `
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
                  `
                  : `
                    <div class="timeline-item timeline-item--warning">
                      <strong>Sem base de calendario disponivel</strong>
                      <p>Nesta fase so ha grupos fora da agenda local ou com scheduling desligado.</p>
                    </div>
                  `
              }
            </div>
            <div class="week-editor__section">
              <p class="week-section-note">Como ler os estados da semana.</p>
              <ul class="week-state-legend">
                <li><strong>Por enviar</strong>: o lembrete ja existe e ainda nao fechou envio.</li>
                <li><strong>A confirmar</strong>: houve tentativa e o sistema esta a aguardar validacao forte.</li>
                <li><strong>Fechados</strong>: o envio ja foi observado como concluido.</li>
              </ul>
            </div>
            <div class="week-editor__section">
              <p class="week-section-note">Como usar esta pagina sem te perderes.</p>
              <ul>
                <li>Comeca pela leitura rapida e pelo painel lateral antes de abrires a grelha completa.</li>
                <li>Usa "Criar neste dia" ou "Abrir no editor" para focar logo o que interessa.</li>
                <li>Abre a grelha completa apenas quando precisares de comparar varios dias ao mesmo tempo.</li>
              </ul>
            </div>
          </div>
        </article>
      </section>

      <section class="surface content-card">
        <details class="ui-details week-calendar-details">
          <summary>Ver grelha completa da semana</summary>
          <div class="ui-details__content">
            <p class="week-section-note">Vista detalhada dia a dia para quando precisares mesmo de comparar a semana toda.</p>
            ${
              distributionGroups.length > 0
                ? `
                  <div class="week-mode-strip" data-week-mode-strip>
                    <strong>So distribuicao</strong>
                    <span>${escapeHtml(
                      distributionGroups.map((group) => group.preferredSubject).join(', '),
                    )}</span>
                    <span>Estes grupos nao aceitam edicao local nesta agenda.</span>
                  </div>
                `
                : ''
            }
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
                          label: day.events.length > 0 ? `${day.events.length} evento(s)` : 'Sem agenda',
                          tone: day.events.length > 0 ? 'positive' : 'neutral',
                        })}
                      </div>
                      <div class="week-calendar__day-meta">
                        ${renderUiBadge({
                          label: `Por enviar ${day.notifications.pendingNotifications}`,
                          tone: day.notifications.pendingNotifications > 0 ? 'neutral' : 'positive',
                          style: 'chip',
                        })}
                        ${renderUiBadge({
                          label: `A confirmar ${day.notifications.waitingConfirmationNotifications}`,
                          tone: day.notifications.waitingConfirmationNotifications > 0 ? 'warning' : 'neutral',
                          style: 'chip',
                        })}
                        ${renderUiBadge({
                          label: `Fechados ${day.notifications.sentNotifications}`,
                          tone: day.notifications.sentNotifications > 0 ? 'positive' : 'neutral',
                          style: 'chip',
                        })}
                      </div>
                      <div class="action-row week-calendar__day-actions">
                        ${renderUiActionButton({
                          label: 'Criar neste dia',
                          variant: 'secondary',
                          disabled: schedulableGroups.length === 0,
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
                                .map((event) =>
                                  renderWeekCalendarEventCard(
                                    event,
                                    draft.eventId === event.eventId,
                                    groupsByJid.get(event.groupJid) ?? null,
                                  ),
                                )
                                .join('')
                            : `
                              <div class="week-calendar__empty">
                                <p>Sem eventos planeados neste dia.</p>
                                <p>${
                                  schedulableGroups.length > 0
                                    ? 'Usa o botao acima para abrir o editor logo neste dia.'
                                    : 'Quando um grupo voltar a agenda local, esta grelha volta a aceitar criacao.'
                                }</p>
                              </div>
                            `
                        }
                      </div>
                    </section>
                  `,
                )
                .join('')}
            </div>
          </div>
        </details>
      </section>
    `;
  }

  private renderAssistantPage(page: UiPage<AssistantPageData>): string {
    const draft = resolveAssistantSchedulingDraft(this.state.assistantSchedulingDraft, page.data.groups);
    const selectedGroup = page.data.groups.find((group) => group.groupJid === draft.groupJid) ?? null;
    const preview = draft.preview;
    const canApply = Boolean(preview?.canApply && preview.previewFingerprint);
    const canRunLlmScheduling = Boolean(selectedGroup && canGroupUseLlmScheduling(selectedGroup));
    const assistantRoutingNote = selectedGroup
      ? describeAssistantSchedulingState(selectedGroup)
      : 'Quando quiseres mexer na agenda, escolhe primeiro um grupo.';
    const assistantFallbackHref = !selectedGroup
      ? '/groups'
      : selectedGroup.operationalSettings.mode === 'distribuicao_apenas'
        ? '/distributions'
        : '/week';
    const assistantFallbackLabel = !selectedGroup
      ? 'Abrir grupos'
      : selectedGroup.operationalSettings.mode === 'distribuicao_apenas'
        ? 'Abrir distribuicoes'
        : 'Abrir calendario semanal';
    const latestAudit = page.data.recentSchedulingAudit[0] ?? null;
    const chatGroups = page.data.groups.length > 0 ? page.data.groups : this.state.assistantRailChat.availableGroups;
    const selectedChatGroup =
      chatGroups.find((group) => group.groupJid === this.state.assistantRailChat.selectedGroupJid) ?? null;
    const chatContextLabel =
      this.state.assistantRailChat.contextMode === 'group'
        ? selectedChatGroup?.preferredSubject ?? 'Escolhe um grupo'
        : 'Global';
    const chatCanSend = Boolean(
      this.state.assistantRailChat.input.trim().length > 0 &&
      !this.state.assistantRailChat.sending &&
      (this.state.assistantRailChat.contextMode === 'global' || this.state.assistantRailChat.selectedGroupJid),
    );
    const chatScopeSummary =
      this.state.assistantRailChat.contextMode === 'group'
        ? selectedChatGroup
          ? `A conversa usa instrucoes e knowledge de ${selectedChatGroup.preferredSubject}, mas fica so nesta pagina.`
          : 'Escolhe um grupo para a LLM responder com memoria desse grupo.'
        : 'A conversa e global: a LLM nao assume um grupo WhatsApp especifico e nao envia mensagens para lado nenhum.';
    const hasSchedulingIntent = Boolean(
      draft.text.trim().length > 0 || draft.previewLoading || draft.applying || preview || draft.lastApplied,
    );
    const actionStatusLabel = !selectedGroup
      ? 'Sem grupo pronto'
      : !canRunLlmScheduling
        ? 'Indisponivel aqui'
        : draft.previewLoading
          ? 'A gerar preview'
          : preview
            ? preview.canApply
              ? 'Preview pronto'
              : 'Rever pedido'
            : 'Pronto quando quiseres';
    const actionStatusTone: UiTone = !selectedGroup
      ? 'warning'
      : !canRunLlmScheduling
        ? 'warning'
        : draft.previewLoading
          ? 'warning'
          : preview
            ? preview.canApply
              ? 'positive'
              : 'warning'
            : 'positive';
    const actionStatusSummary = !selectedGroup
      ? 'O bloco da agenda so aparece quando houver um grupo disponivel e uma intencao clara de mexer no calendario.'
      : canRunLlmScheduling
        ? preview
          ? preview.summary
          : 'Quando precisares de alterar a agenda, abres o bloco abaixo, pedes preview e so depois confirmas.'
        : assistantRoutingNote;
    const previewStatusLabel = preview
      ? preview.canApply
        ? 'Preview pronto'
        : 'Rever pedido'
      : draft.previewLoading
        ? 'A gerar preview'
        : 'Sem preview';
    const previewStatusTone: UiTone = preview
      ? preview.canApply
        ? 'positive'
        : 'warning'
      : draft.previewLoading
        ? 'warning'
        : 'neutral';
    const previewSummaryText = draft.previewLoading
      ? 'A gerar preview.'
      : preview
        ? preview.summary
        : canRunLlmScheduling
          ? 'Ainda sem preview. Escreve o pedido e gera a confirmacao antes de aplicar.'
          : assistantRoutingNote;
    const recentSchedulingEntries = page.data.recentSchedulingAudit.slice(0, 3);
    const recentContextSignals = [
      ...page.data.recentLlmRuns.slice(0, 3).map((entry) => ({
        sortAt: Date.parse(entry.createdAt),
        title: 'Resposta da LLM',
        recordedAt: `${formatShortDateTime(entry.createdAt)} • ${entry.modelId}`,
        summary: entry.outputSummary,
        detail:
          entry.memoryScope?.scope === 'group'
            ? `Escopo: ${entry.memoryScope.groupLabel ?? entry.memoryScope.groupJid ?? 'grupo'}`
            : 'Escopo: global',
      })),
      ...page.data.recentConversationAudit.slice(0, 2).map((entry) => ({
        sortAt: Date.parse(entry.createdAt),
        title: 'Conversa auditada',
        recordedAt: formatShortDateTime(entry.createdAt),
        summary: describeAssistantConversationMemory(entry),
        detail: `Intencao lida: ${entry.intent}`,
      })),
    ]
      .sort((left, right) => right.sortAt - left.sortAt)
      .slice(0, 3);
    const hasRecentActivity = recentSchedulingEntries.length > 0 || recentContextSignals.length > 0;
    const shouldOpenScheduling = hasSchedulingIntent;
    const shouldOpenActivity = Boolean(draft.lastApplied);
    const schedulingDisclosureLabel = draft.applying
      ? 'A aplicar a mudanca na agenda'
      : draft.previewLoading
        ? 'A gerar preview da agenda'
        : preview
          ? preview.canApply
            ? 'Preview pronto para confirmar'
            : 'Preview gerado, mas precisa de ajuste'
          : !selectedGroup
            ? 'Quero mudar a agenda com a LLM'
            : !canRunLlmScheduling
              ? 'Mudar a agenda com a LLM (indisponivel neste grupo)'
              : hasSchedulingIntent
                ? 'Continuar mudanca da agenda'
                : 'Quero mudar a agenda com a LLM';
    const schedulingActivityHtml =
      recentSchedulingEntries.length > 0
        ? recentSchedulingEntries
            .map(
              (entry) => `
                <article class="timeline-item">
                  <strong>${escapeHtml(entry.groupLabel ?? entry.groupJid ?? 'Grupo')}</strong>
                  <time>${escapeHtml(`${readableAssistantOperation(entry.operation)} • ${formatShortDateTime(entry.updatedAt)}`)}</time>
                  <p>${escapeHtml(entry.previewSummary)}</p>
                  <p class="detail-line">Pedido: ${escapeHtml(entry.requestedText)}</p>
                  <p class="detail-line">Estado: ${escapeHtml(readableInstructionStatus(entry.status))}</p>
                  ${
                    entry.appliedEventTitle
                      ? `<p class="detail-line">Evento: ${escapeHtml(entry.appliedEventTitle)}</p>`
                      : ''
                  }
                  ${
                    entry.resultNote
                      ? `<p class="detail-line">Nota: ${escapeHtml(entry.resultNote)}</p>`
                      : ''
                  }
                </article>
              `,
            )
            .join('')
        : `
          <div class="inline-empty">
            <strong>Sem alteracoes ainda</strong>
            <p>Assim que aplicares um pedido de scheduling, ele aparece aqui.</p>
          </div>
        `;
    const contextActivityHtml =
      recentContextSignals.length > 0
        ? recentContextSignals
            .map(
              (entry) => `
                <article class="timeline-item">
                  <strong>${escapeHtml(entry.title)}</strong>
                  <time>${escapeHtml(entry.recordedAt)}</time>
                  <p>${escapeHtml(entry.summary)}</p>
                  <p class="detail-line">${escapeHtml(entry.detail)}</p>
                </article>
              `,
            )
            .join('')
        : `
          <div class="inline-empty">
            <strong>Sem sinais recentes</strong>
            <p>Quando houver runs ou conversa auditada, eles aparecem aqui.</p>
          </div>
        `;

    return `
      <section class="surface hero surface--strong llm-hero">
        <div class="llm-hero__copy">
          <p class="eyebrow">Assistente LLM</p>
          <h2>Pergunta aqui sem sair da pagina. A parte da agenda so abre quando quiseres preparar uma mudanca real.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({
              label: 'Abrir calendario',
              variant: 'secondary',
              href: '/week',
              dataAttributes: { route: '/week' },
            })}
            ${renderUiActionButton({
              label: 'Ver grupos',
              variant: 'secondary',
              href: '/groups',
              dataAttributes: { route: '/groups' },
            })}
          </div>
        </div>
        <div class="hero-panel status-list">
          <article class="status-item">
            <strong>Como responde agora</strong>
            <p>${escapeHtml(chatScopeSummary)}</p>
          </article>
          <article class="status-item">
            <strong>Se so queres perguntar</strong>
            <p>Escreve no chat abaixo e le a resposta aqui. Nada segue para o WhatsApp.</p>
          </article>
          <article class="status-item status-item--${actionStatusTone}">
            <strong>${escapeHtml(actionStatusLabel)}</strong>
            <p>${escapeHtml(actionStatusSummary)}</p>
          </article>
          <details class="ui-details">
            <summary>Ver detalhe tecnico</summary>
            <div class="ui-details__content">
              <p><strong>Modelo live</strong>: ${escapeHtml(
                `${page.data.settings.llmRuntime.effectiveProviderId} / ${page.data.settings.llmRuntime.effectiveModelId}`,
              )}</p>
              <p><strong>Ultima auditoria</strong>: ${escapeHtml(
                latestAudit?.previewSummary ?? 'Ainda sem auditoria relevante nesta pagina.',
              )}</p>
            </div>
          </details>
        </div>
      </section>

      <section class="content-grid llm-assistant-grid">
        <article class="surface content-card span-12 llm-chat-workbench">
          <div class="card-header">
            <div>
              <h3>Perguntar sem sair da pagina</h3>
              <p>Usa o chat para pensar em global ou com contexto de um grupo. A resposta fica sempre aqui na interface.</p>
            </div>
            ${renderUiBadge({
              label: this.state.assistantRailChat.sending ? 'A responder' : `Contexto ${chatContextLabel}`,
              tone: this.state.assistantRailChat.sending ? 'warning' : 'positive',
            })}
          </div>

          <div class="rail-chat-stack llm-chat-workbench__stack">
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
                    chatGroups.length > 0
                      ? renderUiSelectField({
                          label: 'Grupo para contexto',
                          value: this.state.assistantRailChat.selectedGroupJid ?? '',
                          dataKey: 'railChat.groupJid',
                          options: chatGroups.map((group) => ({
                            value: group.groupJid,
                            label: `${group.preferredSubject} · ${describeAssistantSchedulingOption(group)}`,
                          })),
                          hint: 'A resposta usa memoria deste grupo, mas continua sem enviar nada.',
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

            ${this.renderAssistantChatHistory(
              'Ainda sem conversa aqui',
              'Escolhe global ou grupo, escreve a pergunta, e a resposta fica aqui sem tocar no WhatsApp.',
              'llm-chat-history--page',
            )}

            <div class="rail-chat-composer">
              <label class="ui-field">
                <span class="ui-field__label">Mensagem para a LLM</span>
                <textarea
                  class="ui-control ui-control--textarea rail-chat-composer__input llm-chat-workbench__input"
                  rows="6"
                  data-field-key="railChat.input"
                  data-rail-chat-input="true"
                  placeholder="Ex.: Resume o que mudou na Aula 1, ou ajuda-me a responder como se eu estivesse no grupo de Anatomia."
                >${escapeHtml(this.state.assistantRailChat.input)}</textarea>
                <span class="ui-field__hint">Enter envia. Shift + Enter cria nova linha. A resposta nao sai da interface.</span>
              </label>

              <div class="rail-chat-actions">
                ${renderUiActionButton({
                  label: this.state.assistantRailChat.sending ? 'A responder...' : 'Enviar pergunta',
                  disabled: !chatCanSend,
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
        </article>
      </section>

      <section class="content-grid llm-assistant-grid">
        <article class="surface content-card span-12 llm-action-card">
          <details class="ui-details llm-disclosure"${shouldOpenScheduling ? ' open' : ''}>
            <summary>${escapeHtml(schedulingDisclosureLabel)}</summary>
            <div class="ui-details__content llm-disclosure__content">
              <div class="card-header">
                <div>
                  <h3>Mudar a agenda com a LLM</h3>
                  <p>So abres este bloco quando queres uma alteracao real. Primeiro ves o preview. So depois decides se aplicas.</p>
                </div>
                ${renderUiBadge({
                  label: previewStatusLabel,
                  tone: previewStatusTone,
                })}
              </div>
              <div class="guide-preview">
                <p><strong>Grupo atual</strong>: ${escapeHtml(selectedGroup?.preferredSubject ?? 'Escolhe primeiro um grupo.')}</p>
                <p><strong>Como funciona</strong>: ${escapeHtml(assistantRoutingNote)}</p>
                <p><strong>Estado</strong>: ${escapeHtml(previewSummaryText)}</p>
                ${
                  draft.lastApplied
                    ? `<p><strong>Ultima alteracao</strong>: ${escapeHtml(
                        draft.lastApplied.appliedEvent
                          ? `${draft.lastApplied.appliedEvent.title} atualizado na agenda.`
                          : draft.lastApplied.appliedInstruction?.status ?? 'Sem estado final.',
                      )}</p>`
                    : ''
                }
              </div>
              <div class="content-grid">
                <section class="span-7 llm-action-editor">
                  <div class="summary-column__header">
                    <h4>Pedido</h4>
                    <p>Escolhe o grupo e descreve a mudanca em linguagem natural.</p>
                  </div>
                  <div class="ui-form-grid">
                    ${renderUiSelectField({
                      label: 'Grupo',
                      value: draft.groupJid,
                      dataKey: 'assistant.groupJid',
                      options: page.data.groups.map((group) => ({
                        value: group.groupJid,
                        label: `${group.preferredSubject} · ${describeAssistantSchedulingOption(group)}`,
                      })),
                      hint: 'Se este grupo nao aceitar mudancas por LLM, mostramos logo a pagina certa para continuar.',
                    })}
                    ${renderUiTextAreaField({
                      label: 'Pedido em linguagem natural',
                      value: draft.text,
                      dataKey: 'assistant.text',
                      rows: 8,
                      placeholder: 'Ex.: Move a Aula 1 de sexta para sabado as 10:00 e deixa nota para levar figurinos.',
                      hint: 'Primeiro sai um preview com resumo e diferencas. A mudanca real so acontece depois da tua confirmacao.',
                    })}
                  </div>
                </section>

                <section class="span-5 llm-preview-card">
                  <div class="summary-column__header">
                    <h4>Preview e confirmacao</h4>
                    <p>Antes de aplicar, confirmas o grupo, o resumo e o que vai mudar.</p>
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
                              <div class="timeline timeline--compact">
                                ${preview.diff
                                  .map(
                                    (entry) => `
                                      <article class="timeline-item">
                                        <strong>${escapeHtml(entry.label)}</strong>
                                        <p class="detail-line">Antes: ${escapeHtml(entry.before ?? 'vazio')}</p>
                                        <p class="detail-line">Depois: ${escapeHtml(entry.after ?? 'vazio')}</p>
                                      </article>
                                    `,
                                  )
                                  .join('')}
                              </div>
                            `
                            : `
                              <div class="inline-empty">
                                <strong>Sem diferencas concretas</strong>
                                <p>Este preview ainda nao mostrou mudancas detalhadas.</p>
                              </div>
                            `
                        }
                      `
                      : `
                        <div class="inline-empty${canRunLlmScheduling ? '' : ' inline-empty--warning'}">
                          <strong>${escapeHtml(canRunLlmScheduling ? 'Ainda sem preview' : 'Mudanca indisponivel neste grupo')}</strong>
                          <p>${escapeHtml(
                            canRunLlmScheduling
                              ? 'Escreve o pedido e gera o preview antes de aplicar.'
                              : assistantRoutingNote,
                          )}</p>
                        </div>
                      `
                  }
                  <div class="action-row">
                    ${renderUiActionButton({
                      label: draft.previewLoading ? 'A gerar preview...' : 'Gerar preview',
                      disabled: draft.previewLoading || draft.applying || !canRunLlmScheduling,
                      dataAttributes: { 'assistant-action': 'preview-schedule' },
                    })}
                    ${renderUiActionButton({
                      label: draft.applying ? 'A aplicar...' : 'Aplicar com confirmacao',
                      variant: 'secondary',
                      disabled: !canRunLlmScheduling || !canApply || draft.previewLoading || draft.applying,
                      dataAttributes: { 'assistant-action': 'apply-schedule' },
                    })}
                    ${
                      selectedGroup && !canRunLlmScheduling
                        ? renderUiActionButton({
                            label: assistantFallbackLabel,
                            href: assistantFallbackHref,
                            variant: 'secondary',
                            dataAttributes: { route: assistantFallbackHref },
                          })
                        : ''
                    }
                  </div>
                </section>
              </div>
            </div>
          </details>
        </article>
      </section>

      <section class="content-grid llm-assistant-grid">
        <article class="surface content-card span-12 llm-activity-card">
          <details class="ui-details llm-disclosure"${shouldOpenActivity ? ' open' : ''}>
            <summary>Ver atividade recente e auditoria</summary>
            <div class="ui-details__content llm-disclosure__content">
              <div class="summary-grid">
                <section class="summary-column">
                  <div class="summary-column__header">
                    <h4>Agenda</h4>
                    <p>Ultimas alteracoes que passaram por preview ou apply.</p>
                  </div>
                  <div class="timeline timeline--compact">
                    ${schedulingActivityHtml}
                  </div>
                </section>
                <section class="summary-column">
                  <div class="summary-column__header">
                    <h4>Como respondeu</h4>
                    <p>Sinais curtos para perceber se o contexto usado foi o esperado.</p>
                  </div>
                  <div class="timeline timeline--compact">
                    ${contextActivityHtml}
                  </div>
                </section>
              </div>
            </div>
          </details>
            </article>
          </section>
        </div>
      </details>
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
    const reminderPolicy = this.state.groupManagementDraft.reminderPolicy;
    const reminderPreviewContext = buildReminderPreviewContext(selectedGroup, page.data.reminderPreviewEvent);
    const reminderVariables = intelligence?.policy.canonicalVariables ?? [];
    const reminderNextEventLabel = page.data.reminderPreviewEvent
      ? `${page.data.reminderPreviewEvent.title} em ${formatWeekEventMoment(page.data.reminderPreviewEvent)}`
      : 'Sem evento real ainda; preview com um exemplo guiado.';

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
          <div class="status-list">
            <article class="status-item status-item--${selectedGroup ? groupModeTone : 'warning'}">
              <strong>Grupo em foco</strong>
              <p>${escapeHtml(
                selectedGroup
                  ? `Estas a gerir ${selectedGroup.preferredSubject}. O owner principal agora e ${primaryOwnerLabel}.`
                  : 'Escolhe um grupo para veres owner, politicas locais, instrucoes e documentos.',
              )}</p>
            </article>
            <article class="status-item status-item--${
              selectedGroup?.operationalSettings.memberTagPolicy === 'members_can_tag' ? 'positive' : 'warning'
            }">
              <strong>Como este grupo responde</strong>
              <p>${escapeHtml(
                selectedGroup
                  ? describeGroupMode(selectedGroup.operationalSettings.mode, selectedGroup.operationalSettings.allowLlmScheduling)
                  : 'Depois de escolheres um grupo, a pagina passa a explicar em linguagem curta o que o bot pode ou nao pode fazer aqui.',
              )}</p>
            </article>
          </div>
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

      <section class="surface content-card group-guided-flow">
        <div class="card-header">
          <div>
            <h3>Fluxo guiado do grupo</h3>
            <p>Usa a pagina por ordem: escolher, perceber, alterar e so depois mexer em automacao ou conhecimento.</p>
          </div>
          ${renderUiBadge({ label: selectedGroup ? 'Grupo escolhido' : 'Falta escolher', tone: selectedGroup ? 'positive' : 'warning' })}
        </div>
        <div class="guided-step-grid">
          <article class="guided-step-card guided-step-card--${selectedGroup ? 'positive' : 'warning'}">
            <strong>1. Escolher</strong>
            <p>${escapeHtml(selectedGroup ? selectedGroup.preferredSubject : 'Seleciona um grupo no mapa para evitar mexer no grupo errado.')}</p>
          </article>
          <article class="guided-step-card guided-step-card--${selectedGroup ? groupModeTone : 'neutral'}">
            <strong>2. Ver estado</strong>
            <p>${escapeHtml(selectedGroup ? `${groupModeLabel}. Owner: ${primaryOwnerLabel}.` : 'Depois da escolha, aparece um resumo humano do estado atual.')}</p>
          </article>
          <article class="guided-step-card guided-step-card--${assistantAuthorized ? 'positive' : 'warning'}">
            <strong>3. Alterar</strong>
            <p>${escapeHtml(selectedGroup ? (assistantAuthorized ? 'O assistente esta ligado; altera permissoes ou modo se precisares.' : 'O assistente esta bloqueado; liga-o se este grupo deve operar.') : 'As alteracoes ficam bloqueadas ate haver grupo em foco.')}</p>
          </article>
          <article class="guided-step-card guided-step-card--${instructionsTone}">
            <strong>4. Completar</strong>
            <p>${escapeHtml(selectedGroup ? (intelligence?.instructions.exists ? 'Conhecimento base ja existe; revê lembretes ou documentos quando fizer sentido.' : 'Falta gravar instrucoes canonicas para este grupo.') : 'A automacao e o conhecimento aparecem abaixo quando houver grupo escolhido.')}</p>
          </article>
        </div>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-4">
          <div class="card-header card-header--with-switch">
            <div>
              <h3>Passo 1. Escolher grupo</h3>
              <p>Escolhe primeiro o grupo. Cada linha mostra o estado essencial e o proximo botao util.</p>
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
                      <p>${escapeHtml(owners)}</p>
                    </button>
                    <div class="group-tile__summary">
                      <div class="ui-card__chips">
                        ${renderUiBadge({
                          label: groupAuthorized ? 'Assistente ligado' : 'Assistente bloqueado',
                          tone: groupAuthorized ? 'positive' : 'warning',
                          style: 'chip',
                        })}
                        ${renderUiBadge({
                          label: readableGroupMode(group.operationalSettings.mode),
                          tone: toneForGroupMode(group.operationalSettings.mode),
                          style: 'chip',
                        })}
                      </div>
                      <div class="action-row group-tile__actions">
                        ${renderUiActionButton({
                          label: isSelected ? 'A gerir' : 'Gerir',
                          variant: isSelected ? 'primary' : 'secondary',
                          dataAttributes: {
                            'group-action': 'select-group',
                            'group-jid': group.groupJid,
                          },
                        })}
                        ${renderUiActionButton({
                          label: groupAuthorized ? 'Bloquear assistente' : 'Ligar assistente',
                          variant: 'secondary',
                          dataAttributes: {
                            'group-action': 'toggle-group-authorized',
                            'group-jid': group.groupJid,
                          },
                        })}
                      </div>
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
              <h3>Passo 2. Ver estado atual</h3>
              <p>Resumo curto antes de mexeres em permissoes, automacao ou conhecimento.</p>
            </div>
            ${renderUiBadge({ label: selectedGroup ? selectedGroup.preferredSubject : 'Escolher grupo', tone: selectedGroup ? 'positive' : 'warning' })}
          </div>
          ${
            selectedGroup
              ? `
                <div class="summary-grid group-page-overview-grid">
                  <div class="summary-column">
                    <div class="summary-column__header">
                      <h4>Leitura rapida</h4>
                      <p>Ficas logo a saber quem manda aqui e se o grupo esta realmente pronto a operar.</p>
                    </div>
                    <div class="status-list">
                      <article class="status-item status-item--${assistantAuthorized ? 'positive' : 'warning'}">
                        <strong>${escapeHtml(assistantAuthorized ? 'Assistente ligado' : 'Assistente bloqueado')}</strong>
                        <p>${escapeHtml(
                          assistantAuthorized
                            ? `${selectedGroup.preferredSubject} pode usar o assistente agora. Owner atual: ${primaryOwnerLabel}.`
                            : `${selectedGroup.preferredSubject} continua visivel, mas o assistente esta bloqueado para este grupo.`,
                        )}</p>
                      </article>
                      <article class="status-item status-item--${groupModeTone}">
                        <strong>${escapeHtml(groupModeLabel)}</strong>
                        <p>${escapeHtml(
                          describeGroupMode(
                            selectedGroup.operationalSettings.mode,
                            selectedGroup.operationalSettings.allowLlmScheduling,
                          ),
                        )}</p>
                      </article>
                      <article class="status-item status-item--${
                        selectedGroup.operationalSettings.memberTagPolicy === 'members_can_tag' ? 'positive' : 'warning'
                      }">
                        <strong>${escapeHtml(memberTagLabel)}</strong>
                        <p>${escapeHtml(
                          selectedGroup.operationalSettings.memberTagPolicy === 'members_can_tag'
                            ? 'Qualquer membro pode chamar o bot quando a policy local o permitir.'
                            : 'O bot fica reservado ao owner do grupo para evitar pedidos soltos.',
                        )}</p>
                      </article>
                      <article class="status-item status-item--${instructionsTone}">
                        <strong>Instrucoes deste grupo</strong>
                        <p>${escapeHtml(
                          intelligence?.instructions.exists
                            ? `Ja existe uma base canonica para este grupo em ${intelligence.instructions.primaryFilePath}.`
                            : 'Ainda falta gravar instrucoes canonicas para este grupo.',
                        )}</p>
                      </article>
                    </div>
                  </div>
                  <div class="summary-column">
                    <div class="summary-column__header">
                      <h4>Calendario e scheduling</h4>
                      <p>Separado por papel e pelo que o grupo deixa fazer neste momento.</p>
                    </div>
                    <div class="status-list">
                      <article class="status-item status-item--${
                        selectedGroup.operationalSettings.schedulingEnabled ? 'positive' : 'warning'
                      }">
                        <strong>${escapeHtml(schedulingLabel)}</strong>
                        <p>${escapeHtml(
                          selectedGroup.operationalSettings.schedulingEnabled
                            ? 'O grupo pode manter scheduling local ativo.'
                            : 'O scheduling local fica desligado ate voltares a ativar este switch.',
                        )}</p>
                      </article>
                      <article class="status-item status-item--${
                        selectedGroup.operationalSettings.allowLlmScheduling ? 'positive' : 'warning'
                      }">
                        <strong>${escapeHtml(llmSchedulingLabel)}</strong>
                        <p>${escapeHtml(
                          selectedGroup.operationalSettings.allowLlmScheduling
                            ? 'A LLM pode preparar ou decidir scheduling neste grupo.'
                            : 'A LLM fica impedida de mexer em scheduling neste grupo.',
                        )}</p>
                      </article>
                      <article class="status-item">
                        <strong>Calendario por papel</strong>
                        <p>${escapeHtml(
                          `Membros ${readableCalendarAccessMode(selectedGroup.calendarAccessPolicy.group)}, Responsavel ${readableCalendarAccessMode(selectedGroup.calendarAccessPolicy.groupOwner)}, Admin ${readableCalendarAccessMode(selectedGroup.calendarAccessPolicy.appOwner)}.`,
                        )}</p>
                      </article>
                    </div>
                  </div>
                  <div class="summary-column">
                    <div class="summary-column__header">
                      <h4>Permissoes efetivas</h4>
                      <p>Leitura curta por papel para perceber bot e scheduling sem abrir diagnostico tecnico.</p>
                    </div>
                    <div class="compact-record">
                      <div class="compact-record__body">
                        <p>Esta leitura mostra quem consegue realmente dirigir o bot e o que acontece com agendamento neste grupo.</p>
                        ${renderGroupEffectivePermissionList({
                          assistantAuthorized,
                          calendarAccessPolicy: selectedGroup.calendarAccessPolicy,
                          operationalSettings: selectedGroup.operationalSettings,
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div class="group-guided-edit-grid">
                  <article class="group-guided-card">
                    <div class="summary-column__header">
                      <h4>Permissoes</h4>
                      <p>Quem responde por este grupo e quem pode chamar o bot.</p>
                    </div>
                    <div class="ui-form-grid">
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
                        <span class="ui-field__label">Quem pode tagar o bot</span>
                        <select
                          class="ui-control"
                          data-group-operational-setting="memberTagPolicy"
                          data-group-jid="${escapeHtml(selectedGroup.groupJid)}"
                        >
                          <option value="members_can_tag"${selectedGroup.operationalSettings.memberTagPolicy === 'members_can_tag' ? ' selected' : ''}>Membros podem tagar</option>
                          <option value="owner_only"${selectedGroup.operationalSettings.memberTagPolicy === 'owner_only' ? ' selected' : ''}>So o owner pode tagar</option>
                        </select>
                        <span class="ui-field__hint">Mantem simples: decide se qualquer membro pode chamar o bot ou se fica reservado ao owner.</span>
                      </label>
                    </div>
                  </article>
                  <article class="group-guided-card">
                    <div class="summary-column__header">
                      <h4>Automacao</h4>
                      <p>Como o grupo usa scheduling e se a LLM pode ajudar nas mudancas.</p>
                    </div>
                    <div class="ui-form-grid">
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
                        <span class="ui-field__hint">Escolhe entre agenda local assistida ou apenas distribuicao.</span>
                      </label>
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
                  </article>
                </div>
                ${
                  this.state.advancedDetailsEnabled
                    ? `
                        <details class="ui-details">
                          <summary>Ver detalhe tecnico</summary>
                          <div class="ui-details__content">
                            <p>JID: ${escapeHtml(selectedGroup.groupJid)}</p>
                            <p>Alias: ${escapeHtml(selectedGroup.aliases.join(', ') || 'sem alias')}</p>
                            <p>Instrucoes canonicas: ${escapeHtml(intelligence?.instructions.primaryFilePath ?? 'ainda sem ficheiro carregado')}</p>
                          </div>
                        </details>
                      `
                    : ''
                }
              `
              : `
                  <div class="inline-empty">
                    <strong>Escolhe primeiro um grupo</strong>
                    <p>Assim que escolheres um grupo, esta area passa a mostrar owner, modo local, regras de tag e permissao real do assistente.</p>
                  </div>
                `
          }
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-7">
          <div class="card-header card-header--with-switch">
            <div>
              <h3>Passo 3. Automacao e lembretes</h3>
              <p>Define os avisos deste grupo depois de confirmares que o modo e as permissoes estao certos.</p>
            </div>
            ${
              selectedGroup
                ? renderUiSwitch({
                    label: 'Lembretes ativos',
                    checked: reminderPolicy.enabled,
                    description: reminderPolicy.enabled
                      ? `${reminderPolicy.reminders.length} regra(s) prontas neste grupo.`
                      : 'Os novos eventos deste grupo passam a nascer sem lembretes.',
                    dataAttributes: {
                      'group-action': 'toggle-reminder-policy-enabled',
                    },
                  })
                : renderUiBadge({ label: 'Escolher grupo', tone: 'warning' })
            }
          </div>
          ${
            selectedGroup
              ? `
                <div class="guide-preview">
                  <p><strong>Evento de exemplo</strong>: ${escapeHtml(reminderNextEventLabel)}</p>
                  <p><strong>O que acontece ao guardar</strong>: os novos eventos deste grupo passam a herdar estes lembretes. Se mudares um evento, a fila acompanha a mudanca.</p>
                </div>
                <div class="action-row">
                  ${renderUiActionButton({
                    label: 'Adicionar lembrete',
                    dataAttributes: { 'group-action': 'add-reminder' },
                  })}
                  ${renderUiActionButton({
                    label: 'Repor defaults',
                    variant: 'secondary',
                    dataAttributes: { 'group-action': 'reset-reminder-policy' },
                  })}
                  ${renderUiActionButton({
                    label: 'Guardar lembretes',
                    variant: 'secondary',
                    dataAttributes: { 'group-action': 'save-reminder-policy' },
                  })}
                </div>
                ${
                  reminderPolicy.reminders.length > 0
                    ? `
                      <div class="group-reminder-list">
                        ${reminderPolicy.reminders
                          .map(
                            (reminder, index) => `
                              <article class="group-reminder-card">
                                <div class="group-reminder-card__header">
                                  <div>
                                    <h4>${escapeHtml(readableReminderSummary(reminder))}</h4>
                                    <p>${escapeHtml(
                                      reminder.enabled
                                        ? 'Este lembrete entra na fila quando chegar a hora.'
                                        : 'Fica guardado, mas nao entra na fila enquanto estiver desligado.',
                                    )}</p>
                                  </div>
                                  <div class="card-header__actions">
                                    ${renderUiSwitch({
                                      label: 'Ativo',
                                      checked: reminder.enabled,
                                      description: reminder.enabled ? 'Pronto a usar.' : 'Guardado, mas parado.',
                                      dataAttributes: {
                                        'group-action': 'toggle-reminder-enabled',
                                        'reminder-index': String(index),
                                      },
                                    })}
                                    ${renderUiActionButton({
                                      label: 'Retirar',
                                      variant: 'secondary',
                                      dataAttributes: {
                                        'group-action': 'remove-reminder',
                                        'reminder-index': String(index),
                                      },
                                    })}
                                  </div>
                                </div>
                                <div class="ui-form-grid ui-form-grid--equal">
                                  ${renderUiInputField({
                                    label: 'Nome curto',
                                    value: reminder.label,
                                    dataKey: `group.reminder.${index}.label`,
                                    placeholder: 'Ex.: Ultima chamada',
                                    hint: 'Opcional. Se deixares vazio, usamos o resumo automatico.',
                                  })}
                                  ${renderUiSelectField({
                                    label: 'Quando enviar',
                                    value: reminder.timingMode,
                                    dataKey: `group.reminder.${index}.timingMode`,
                                    options: [
                                      { value: 'relative_before_event', label: 'X tempo antes' },
                                      { value: 'fixed_previous_day', label: 'Hora fixa no dia anterior' },
                                      { value: 'fixed_same_day', label: 'Hora fixa no proprio dia' },
                                      { value: 'relative_after_event', label: 'X tempo depois' },
                                    ],
                                  })}
                                </div>
                                <div class="ui-form-grid ui-form-grid--equal">
                                  ${
                                    reminder.timingMode === 'fixed_previous_day' || reminder.timingMode === 'fixed_same_day'
                                      ? renderUiInputField({
                                          label: 'Hora local',
                                          value: reminder.localTime,
                                          dataKey: `group.reminder.${index}.localTime`,
                                          type: 'time',
                                          hint:
                                            reminder.timingMode === 'fixed_previous_day'
                                              ? 'Ex.: 18:00 no dia anterior.'
                                              : 'Ex.: 08:30 no proprio dia.',
                                        })
                                      : renderUiInputField({
                                          label: 'Janela em minutos',
                                          value: reminder.offsetMinutes,
                                          dataKey: `group.reminder.${index}.offsetMinutes`,
                                          type: 'number',
                                          placeholder: reminder.timingMode === 'relative_after_event' ? '30' : '60',
                                          hint:
                                            reminder.timingMode === 'relative_after_event'
                                              ? 'Quantos minutos depois do evento queres este follow-up.'
                                              : 'Quantos minutos antes do evento queres este aviso.',
                                        })
                                  }
                                  <div class="inline-empty">
                                    <strong>Resumo humano</strong>
                                    <p>${escapeHtml(readableReminderSummary(reminder))}</p>
                                  </div>
                                </div>
                                <div class="ui-form-grid">
                                  ${renderUiTextAreaField({
                                    label: 'Mensagem base',
                                    value: reminder.messageTemplate,
                                    dataKey: `group.reminder.${index}.messageTemplate`,
                                    rows: 4,
                                    placeholder: 'Ex.: Daqui a {{hours_until_event}} horas temos {{event_title}}.',
                                    hint: 'Se a LLM falhar ou estiver vazia, esta mensagem e usada diretamente.',
                                  })}
                                  ${renderUiTextAreaField({
                                    label: 'Prompt para a LLM',
                                    value: reminder.llmPromptTemplate,
                                    dataKey: `group.reminder.${index}.llmPromptTemplate`,
                                    rows: 4,
                                    placeholder: 'Ex.: Escreve um lembrete curto para WhatsApp com o contexto abaixo...',
                                    hint: 'Se preenchido, a LLM personaliza o texto final antes do envio.',
                                  })}
                                </div>
                              </article>
                            `,
                          )
                          .join('')}
                      </div>
                    `
                    : `
                      <div class="inline-empty">
                        <strong>Ainda sem lembretes</strong>
                        <p>Adiciona o primeiro para este grupo. Podes misturar antes, hora fixa e depois.</p>
                      </div>
                    `
                }
              `
              : `
                <div class="inline-empty">
                  <strong>Escolhe um grupo</strong>
                  <p>Quando escolheres um grupo, esta area passa a mostrar a grelha de lembretes e a copy associada.</p>
                </div>
              `
          }
        </article>

        <article class="surface content-card span-5">
          <div class="card-header">
            <div>
              <h3>Preview da comunicacao</h3>
              <p>Mostra a mensagem base e o prompt antes de esses lembretes entrarem na rotina do grupo.</p>
            </div>
            ${renderUiBadge({
              label: selectedGroup ? `${reminderPolicy.reminders.length} regra(s)` : 'Sem grupo',
              tone: selectedGroup ? 'positive' : 'warning',
            })}
          </div>
          ${
            selectedGroup
              ? `
                <div class="guide-preview">
                  <p><strong>Evento em preview</strong>: ${escapeHtml(reminderNextEventLabel)}</p>
                  <p><strong>Grupo</strong>: ${escapeHtml(reminderPreviewContext.groupLabel)}</p>
                </div>
                <div class="ui-card__chips">
                  ${reminderVariables
                    .slice(0, 8)
                    .map((variable) =>
                      renderUiBadge({
                        label: `{{${variable.key}}}`,
                        tone: 'neutral',
                        style: 'chip',
                      }),
                    )
                    .join('')}
                </div>
                <div class="group-reminder-preview-list">
                  ${reminderPolicy.reminders
                    .slice(0, 3)
                    .map((reminder) => {
                      const preview = buildReminderPreview(reminder, reminderPreviewContext);

                      return `
                        <article class="timeline-item">
                          <strong>${escapeHtml(readableReminderSummary(reminder))}</strong>
                          <time>${escapeHtml(preview.sendLabel)}</time>
                          <p><strong>Mensagem base</strong>: ${escapeHtml(preview.messagePreview)}</p>
                          <p><strong>Prompt LLM</strong>: ${escapeHtml(preview.promptPreview)}</p>
                        </article>
                      `;
                    })
                    .join('')}
                </div>
                <details class="ui-details">
                  <summary>Ver catalogo de variaveis</summary>
                  <div class="ui-details__content">
                    <div class="timeline">
                      ${reminderVariables
                        .map(
                          (variable) => `
                            <article class="timeline-item">
                              <strong>{{${escapeHtml(variable.key)}}}</strong>
                              <p>${escapeHtml(variable.description)}</p>
                              <time>${escapeHtml(variable.example)}</time>
                            </article>
                          `,
                        )
                        .join('')}
                    </div>
                  </div>
                </details>
              `
              : `
                <div class="inline-empty">
                  <strong>Preview indisponivel</strong>
                  <p>Escolhe primeiro um grupo para veres a linguagem base e as variaveis dos lembretes.</p>
                </div>
              `
          }
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-7">
          <div class="card-header">
            <div>
              <h3>Passo 4. Conhecimento do grupo</h3>
              <p>Guarda linguagem, regras e contexto para a LLM perceber este grupo sem depender de memoria solta.</p>
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
                            <div class="inline-empty">
                              <strong>Sem snippets relevantes</strong>
                              <p>Experimenta outra pergunta ou reforca os documentos deste grupo.</p>
                            </div>
                          `
                      }
                    `
                    : `
                        <div class="inline-empty">
                          <strong>Preview ainda por gerar</strong>
                          <p>Escreve uma pergunta de teste e carrega em atualizar preview para veres o contexto real deste grupo.</p>
                        </div>
                      `
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
              : `
                  <div class="inline-empty">
                    <strong>Escolhe um grupo</strong>
                    <p>Quando escolheres um grupo, esta area passa a juntar instrucoes canonicas e preview de contexto no mesmo sitio.</p>
                  </div>
                `
          }
        </article>

        <article class="surface content-card span-5">
          <div class="card-header">
            <div>
              <h3>Documentos e normas</h3>
              <p>Normas, excecoes e materiais ficam guardados na pasta do proprio grupo.</p>
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
                        <div class="inline-empty">
                          <strong>Sem documentos ainda</strong>
                          <p>Podes guardar aqui o primeiro documento desta knowledge base.</p>
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
              : `
                  <div class="inline-empty">
                    <strong>Escolhe primeiro um grupo</strong>
                    <p>Assim que tiveres um grupo ativo, esta area passa a gerir os documentos e o markdown desse contexto.</p>
                  </div>
                `
          }
        </article>
      </section>
    `;
  }

  private renderWhatsAppPage(page: UiPage<WhatsAppManagementPageData>): string {
    const snapshot = page.data.workspace;
    const people = buildWorkspacePeople(page.data);
    const liveQrVisible = this.state.whatsappQrPreviewVisible && snapshot.runtime.qr.available && snapshot.runtime.qr.svg;
    const sessionLabel = readableSessionPhase(snapshot.runtime.session.phase);
    const sessionTone = toneForSessionPhase(snapshot.runtime.session.phase);
    const knownPeopleCount = people.filter((person) => person.personId).length;
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
          <h2>Ver o estado da sessao, a auth ativa e o que o canal conhece neste momento.</h2>
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
            ${renderUiActionButton({ label: 'Abrir LumeHub', href: '/settings', variant: 'secondary', dataAttributes: { route: '/settings' } })}
          </div>
        </div>
        <div class="hero-panel">
          <div class="status-list">
            <article class="status-item status-item--${sessionTone}">
              <strong>Sessao atual</strong>
              <p>${escapeHtml(
                snapshot.runtime.session.connected
                  ? 'A sessao esta aberta e pronta para discovery e envio real.'
                  : snapshot.runtime.session.loginRequired
                    ? 'Ainda falta autenticar a sessao. O QR aparece quando o backend o publicar.'
                    : 'A ligacao existe mas ainda nao esta pronta. Vale a pena rever QR e reconnect.',
              )}</p>
            </article>
            <article class="status-item status-item--${snapshot.runtime.qr.available ? 'positive' : 'warning'}">
              <strong>Proximo passo</strong>
              <p>${escapeHtml(nextWhatsAppStep)}</p>
            </article>
          </div>
        </div>
      </section>

      <section class="surface content-card">
        <div class="card-header">
          <div>
            <h3>Fluxo guiado do WhatsApp</h3>
            <p>Comeca aqui: estado da ligacao, o que falta e o botao certo para continuar.</p>
          </div>
          ${renderUiBadge({ label: sessionLabel, tone: sessionTone })}
        </div>
        <div class="summary-grid">
          <div class="summary-column">
            <div class="summary-column__header">
              <h4>1. Esta ligado?</h4>
              <p>Estado live da sessao e ultimo sinal conhecido.</p>
            </div>
            <div class="status-list">
              <article class="status-item status-item--${sessionTone}">
                <strong>${escapeHtml(sessionLabel)}</strong>
                <p>${escapeHtml(snapshot.runtime.session.lastError ?? 'Sem erro live conhecido nesta sessao.')}</p>
              </article>
            </div>
          </div>
          <div class="summary-column">
            <div class="summary-column__header">
              <h4>2. O que falta?</h4>
              <p>Mostra se o assistente ja esta autorizado onde interessa.</p>
            </div>
            <div class="status-list">
              <article class="status-item status-item--${
                snapshot.permissionSummary.authorizedGroups > 0 ? 'positive' : 'warning'
              }">
                <strong>${escapeHtml(
                  `${snapshot.permissionSummary.authorizedGroups}/${snapshot.permissionSummary.knownGroups} grupos ligados`,
                )}</strong>
                <p>Grupos onde o assistente pode atuar agora.</p>
              </article>
              <article class="status-item status-item--${
                snapshot.settings.whatsapp.groupDiscoveryEnabled ? 'positive' : 'warning'
              }">
                <strong>${escapeHtml(
                  snapshot.settings.whatsapp.groupDiscoveryEnabled
                    ? 'Descoberta de grupos ativa'
                    : 'Descoberta de grupos desligada',
                )}</strong>
                <p>${escapeHtml(
                  snapshot.settings.whatsapp.conversationDiscoveryEnabled
                    ? 'As conversas privadas tambem estao a ser descobertas.'
                    : 'As conversas privadas continuam fora do discovery automatico.',
                )}</p>
              </article>
            </div>
          </div>
          <div class="summary-column">
            <div class="summary-column__header">
              <h4>3. Qual o proximo botao?</h4>
              <p>Um operador pouco tecnico deve conseguir continuar daqui.</p>
            </div>
            <div class="status-list">
              <article class="status-item status-item--${snapshot.runtime.session.connected ? 'positive' : 'warning'}">
                <strong>Proximo passo</strong>
                <p>${escapeHtml(nextWhatsAppStep)}</p>
              </article>
            </div>
          </div>
        </div>
        <div class="whatsapp-repair-wizard">
          <div class="summary-column__header">
            <h4>Reparacao guiada</h4>
            <p>Escolhe o problema que estas a tentar resolver e segue a checklist curta.</p>
          </div>
          <div class="action-row">
            ${(['auth', 'groups', 'permissions'] as const)
              .map((focus) =>
                renderUiActionButton({
                  label: readableRepairFocus(focus),
                  variant: this.state.whatsappRepairFocus === focus ? 'primary' : 'secondary',
                  dataAttributes: {
                    'flow-action': 'repair-focus',
                    'flow-value': focus,
                  },
                }),
              )
              .join('')}
          </div>
          <div class="guide-preview guide-preview--${repairTone(this.state.whatsappRepairFocus, snapshot)}">
            ${renderRepairChecklist(this.state.whatsappRepairFocus, snapshot)}
          </div>
        </div>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-5">
          <div class="card-header">
            <h3>Passo 1. Ligar ou reparar sessao</h3>
            ${renderUiBadge({ label: sessionLabel, tone: sessionTone })}
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
              <div class="inline-empty${snapshot.runtime.session.connected ? '' : ' inline-empty--warning'}">
                <strong>Estado atual</strong>
                <p>${escapeHtml(snapshot.runtime.session.lastError ?? 'Sem erro live conhecido.')}</p>
                <p>Depois do scan, confirma sessao ligada, grupos descobertos e permissoes base.</p>
              </div>
            `}
            <details class="ui-details">
              <summary>Controlos do canal</summary>
              <div class="ui-details__content">
                <div class="action-row">
                  ${renderUiActionButton({
                    label: snapshot.settings.whatsapp.enabled ? 'Desligar canal' : 'Ligar canal',
                    variant: snapshot.settings.whatsapp.enabled ? 'secondary' : 'primary',
                    dataAttributes: { 'whatsapp-action': 'toggle-whatsapp-enabled' },
                  })}
                </div>
                <div class="status-list">
                  <article class="status-item status-item--${snapshot.runtime.session.sessionPresent ? 'positive' : 'warning'}">
                    <strong>${escapeHtml(snapshot.runtime.session.sessionPresent ? 'Sessao presente' : 'Sessao em falta')}</strong>
                    <p>${escapeHtml(snapshot.runtime.qr.available ? 'Existe um QR publicado para retomar o emparelhamento.' : 'Nao ha QR ativo neste momento.')}</p>
                  </article>
                  <article class="status-item status-item--${
                    snapshot.settings.whatsapp.sharedAuthWithCodex ? 'positive' : 'warning'
                  }">
                    <strong>${escapeHtml(
                      snapshot.settings.whatsapp.sharedAuthWithCodex ? 'Mesmo auth do Codex' : 'Auth isolado',
                    )}</strong>
                    <p>${escapeHtml(
                      snapshot.settings.whatsapp.groupDiscoveryEnabled
                        ? 'A descoberta de grupos esta ligada.'
                        : 'A descoberta de grupos esta pausada.',
                    )} ${escapeHtml(
                      snapshot.settings.whatsapp.conversationDiscoveryEnabled
                        ? 'As conversas privadas tambem estao a ser descobertas.'
                        : 'As conversas privadas continuam com discovery desligado.',
                    )}</p>
                  </article>
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
                <div class="inline-empty">
                  <strong>Fora desta pagina</strong>
                  <p>Os switches globais do produto e os privados do assistente vivem agora na pagina <strong>LumeHub</strong>.</p>
                </div>
              </div>
            </details>
          </div>
        </article>

        <article class="surface content-card span-7">
          <div class="card-header">
            <div>
              <h3>Diagnostico de identidades</h3>
              <p>Pessoas e privados ficam recolhidos para nao distrair da ligacao e dos grupos.</p>
            </div>
            ${renderUiBadge({ label: `${knownPeopleCount} pessoas`, tone: 'neutral' })}
          </div>
          <details class="ui-details whatsapp-diagnostics-details">
            <summary>Ver pessoas e conversas privadas</summary>
            <div class="ui-details__content">
              <div class="compact-record-list">
                ${people.length > 0
                  ? people
                      .map(
                        (person) => `
                          <article class="compact-record">
                            <div class="compact-record__header">
                              <div>
                                <strong>${escapeHtml(person.displayName)}</strong>
                                <p>${escapeHtml(person.globalRoles.includes('app_owner') ? 'App owner conhecido' : 'Membro conhecido')}</p>
                              </div>
                              <div class="ui-card__chips">
                                ${renderUiBadge({
                                  label: person.privateAssistantAuthorized ? 'Privado permitido' : 'Privado bloqueado',
                                  tone: person.privateAssistantAuthorized ? 'positive' : 'warning',
                                  style: 'chip',
                                })}
                              </div>
                            </div>
                            <div class="compact-record__body">
                              <p>${escapeHtml(
                                person.whatsappJids.length > 0
                                  ? `${person.whatsappJids.length} contacto(s) WhatsApp conhecido(s).`
                                  : 'Sem contacto WhatsApp conhecido.',
                              )}</p>
                            </div>
                            <div class="action-row">
                              ${
                                person.ownedGroupJids.length > 0
                                  ? renderUiActionButton({
                                      label: 'Ver grupos',
                                      href: '/groups',
                                      variant: 'secondary',
                                      dataAttributes: { route: '/groups' },
                                    })
                                  : ''
                              }
                            </div>
                          </article>
                        `,
                      )
                      .join('')
                  : `
                      <div class="inline-empty">
                        <strong>Sem pessoas conhecidas</strong>
                        <p>Assim que o runtime reconhecer pessoas, esta lista passa a ficar gerivel aqui.</p>
                      </div>
                    `}
                ${snapshot.conversations.length > 0
                  ? snapshot.conversations
                      .map(
                        (conversation) => `
                          <article class="compact-record">
                            <div class="compact-record__header">
                              <div>
                                <strong>${escapeHtml(conversation.displayName)}</strong>
                                <p>${escapeHtml(
                                  conversation.privateAssistantAuthorized ? 'Privado permitido' : 'Privado bloqueado',
                                )}</p>
                              </div>
                            </div>
                            <div class="compact-record__body">
                              <p>${escapeHtml(
                                conversation.ownedGroupJids.length > 0
                                  ? `${conversation.ownedGroupJids.length} grupo(s) associado(s).`
                                  : 'Sem grupos associados.',
                              )}</p>
                            </div>
                          </article>
                        `,
                      )
                      .join('')
                  : `
                      <div class="inline-empty">
                        <strong>Sem privados conhecidos</strong>
                        <p>Quando houver conversas privadas reconhecidas, aparecem aqui.</p>
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
              <h3>Passo 2. Escolher grupos a operar</h3>
              <p>O canal mostra os grupos conhecidos. A configuracao detalhada continua na pagina Grupos.</p>
            </div>
            ${renderUiBadge({ label: `${snapshot.groups.length} grupos`, tone: 'neutral' })}
          </div>
          ${
            snapshot.groups.length > 0
              ? `
                  <div class="group-access-grid">
                    ${snapshot.groups
                      .map(
                        (group) => `
                          <article class="compact-record">
                            <div class="compact-record__header">
                              <div>
                                <strong>${escapeHtml(group.preferredSubject)}</strong>
                                <p>${escapeHtml(group.ownerLabels.join(', ') || 'Sem responsavel definido')}</p>
                              </div>
                              <div class="ui-card__chips">
                                ${renderUiBadge({
                                  label: group.assistantAuthorized ? 'Ligado' : 'Bloqueado',
                                  tone: group.assistantAuthorized ? 'positive' : 'warning',
                                })}
                              </div>
                            </div>
                            <div class="compact-record__body">
                              <p>${escapeHtml(
                                group.assistantAuthorized
                                  ? 'Este grupo ja pode receber operacao do assistente.'
                                  : 'Este grupo esta visivel, mas o assistente ainda esta bloqueado.',
                              )}</p>
                            </div>
                            <div class="action-row">
                              ${renderUiActionButton({
                                label: 'Abrir grupo',
                                href: this.currentRouter().buildGroupRoute(group.groupJid),
                                dataAttributes: {
                                  route: this.currentRouter().buildGroupRoute(group.groupJid),
                                },
                              })}
                            </div>
                            <details class="ui-details">
                              <summary>Ver permissoes deste grupo</summary>
                              <div class="ui-details__content">
                                <p><strong>Calendario</strong>: ${escapeHtml(
                                  `Membros ${readableCalendarAccessMode(group.calendarAccessPolicy.group)}, Responsavel ${readableCalendarAccessMode(group.calendarAccessPolicy.groupOwner)}, Admin ${readableCalendarAccessMode(group.calendarAccessPolicy.appOwner)}.`,
                                )}</p>
                                ${renderGroupEffectivePermissionList(group)}
                              </div>
                            </details>
                            ${
                              this.state.advancedDetailsEnabled
                                ? `
                                    <details class="ui-details">
                                      <summary>Ver detalhe tecnico</summary>
                                      <div class="ui-details__content">
                                        <p>JID: ${escapeHtml(group.groupJid)}</p>
                                        <p>Alias: ${escapeHtml(group.aliases.join(', ') || 'sem alias')}</p>
                                      </div>
                                    </details>
                                  `
                                : ''
                            }
                          </article>
                        `,
                      )
                      .join('')}
                  </div>
                `
              : `
                  <div class="inline-empty">
                    <strong>Sem grupos conhecidos</strong>
                    <p>Assim que o canal descobrir grupos, esta area passa a mostrar owner, permissao real e atalhos de gestao.</p>
                  </div>
                `
          }
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
    const authRouterStatus = snapshot.authRouterStatus;
    const visibleTokenLabel = readCodexTokenCountLabel(authRouterStatus?.accountCount ?? 0);
    const runtimeTone: UiTone = migrationReadiness.runtime.ready ? 'positive' : 'danger';
    const whatsappTone: UiTone = migrationReadiness.whatsapp.connected ? 'positive' : 'warning';
    const llmTone: UiTone = migrationReadiness.llm.mode === 'live' ? 'positive' : 'warning';
    const importTone: UiTone = migrationReadiness.lumeHubState.importedScheduleEvents > 0 ? 'positive' : 'warning';

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Migracao</p>
          <h2>Consola de operador para sair do WA-notify sem confundir com o uso diario.</h2>
          <p>Esta pagina nao e a homepage normal do produto. Usa-a so quando estas a preparar, validar ou aplicar a migracao.</p>
          <div class="action-row">
            ${renderUiActionButton({ label: 'Voltar ao LumeHub', href: '/settings', dataAttributes: { route: '/settings' } })}
            ${renderUiActionButton({ label: 'Ver WhatsApp', href: '/whatsapp', variant: 'secondary', dataAttributes: { route: '/whatsapp' } })}
            ${renderUiActionButton({ label: 'Abrir Codex Router', href: '/codex-router', variant: 'secondary', dataAttributes: { route: '/codex-router' } })}
          </div>
        </div>
        <div class="hero-panel">
          <div class="status-list">
            <article class="status-item status-item--${migrationRecommendationTone}">
              <strong>Proximo passo</strong>
              <p>${escapeHtml(migrationReadiness.summary)}</p>
            </article>
            <article class="status-item status-item--neutral">
              <strong>Papel desta pagina</strong>
              <p>Operador de migracao: prepara a semana paralela, valida importacoes e so depois decide o corte.</p>
            </article>
            <article class="status-item status-item--${authRouterStatus ? 'positive' : 'warning'}">
              <strong>Tokens ficam separados</strong>
              <p>${escapeHtml(
                authRouterStatus
                  ? `O Codex Router tem ${visibleTokenLabel} prontos. Abre a pagina propria para trocar tokens.`
                  : 'A gestao de tokens nao esta disponivel neste runtime.',
              )}</p>
            </article>
          </div>
        </div>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-12">
          <div class="card-header">
            <div>
              <h3>Wizard de operador</h3>
              <p>Segue estes passos por ordem. O objetivo e saber sempre qual e o proximo botao seguro.</p>
            </div>
            ${renderUiBadge({ label: migrationRecommendationLabel, tone: migrationRecommendationTone })}
          </div>
          <div class="migration-operator-wizard">
            <article class="guided-step-card guided-step-card--${runtimeTone}">
              <strong>Passo 1. Confirmar que o LumeHub esta acordado</strong>
              <p>${escapeHtml(
                migrationReadiness.runtime.ready
                  ? 'Backend e runtime estao a responder. Podes continuar.'
                  : `Antes de mexer em imports, resolve o runtime: ${migrationReadiness.runtime.phase}.`,
              )}</p>
            </article>
            <article class="guided-step-card guided-step-card--${whatsappTone}">
              <strong>Passo 2. Confirmar canal e grupos</strong>
              <p>${escapeHtml(
                migrationReadiness.whatsapp.connected
                  ? `${migrationReadiness.whatsapp.discoveredGroups} grupo(s) e ${migrationReadiness.whatsapp.discoveredConversations} conversa(s) visiveis.`
                  : 'Liga ou repara o WhatsApp antes de comparar semanas.',
              )}</p>
            </article>
            <article class="guided-step-card guided-step-card--${importTone}">
              <strong>Passo 3. Importar ou rever dados legacy</strong>
              <p>${escapeHtml(
                migrationReadiness.lumeHubState.importedScheduleEvents > 0
                  ? `${migrationReadiness.lumeHubState.importedScheduleEvents} evento(s) ja estao no runtime novo.`
                  : 'Comeca pelos previews de schedules, alerts e automations antes de aplicar.',
              )}</p>
            </article>
            <article class="guided-step-card guided-step-card--${migrationRecommendationTone}">
              <strong>Passo 4. Decidir semana paralela ou corte</strong>
              <p>${escapeHtml(
                migrationReadiness.cutoverDecisionReady
                  ? 'Ja ha sinais suficientes para decidir cutover com mais seguranca.'
                  : migrationReadiness.summary,
              )}</p>
            </article>
          </div>
          <div class="guide-preview">
            <p><strong>Fase recomendada</strong>: ${escapeHtml(migrationRecommendationLabel)}</p>
            <p><strong>Gerado em</strong>: ${escapeHtml(formatShortDateTime(migrationReadiness.generatedAt))}</p>
            <p>Se so queres usar o produto no dia a dia, esta nao e a entrada certa: volta ao LumeHub ou a Hoje.</p>
          </div>
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-7">
          <div class="card-header">
            <div>
              <h3>Leitura simples da migracao</h3>
              <p>Resumo sem jargao para perceber o que esta pronto e o que ainda pede cuidado.</p>
            </div>
            ${renderUiBadge({
              label: migrationReadiness.recommendedPhase === 'blocked' ? 'Bloqueada' : 'Em preparacao',
              tone: migrationReadiness.recommendedPhase === 'blocked' ? 'danger' : 'warning',
            })}
          </div>
          <div class="summary-grid">
            <div class="summary-column">
              <div class="summary-column__header">
                <h4>Base operacional</h4>
                <p>Sem isto, nao vale a pena comparar semanas.</p>
              </div>
              <div class="status-list">
                <article class="status-item status-item--${migrationReadiness.runtime.ready ? 'positive' : 'danger'}">
                  <strong>${escapeHtml(migrationReadiness.runtime.ready ? 'Pronto' : 'Parado')}</strong>
                  <p>${escapeHtml(
                    migrationReadiness.runtime.phase === 'running'
                      ? 'Backend a responder com tick operacional recente.'
                      : `Fase atual ${migrationReadiness.runtime.phase}.`,
                  )}</p>
                </article>
                <article class="status-item status-item--${migrationReadiness.whatsapp.connected ? 'positive' : 'warning'}">
                  <strong>${escapeHtml(migrationReadiness.whatsapp.connected ? 'WhatsApp ligado' : 'WhatsApp a rever')}</strong>
                  <p>${escapeHtml(
                    `${migrationReadiness.whatsapp.discoveredGroups} grupos e ${migrationReadiness.whatsapp.discoveredConversations} conversas visiveis.`,
                  )}</p>
                </article>
              </div>
            </div>
            <div class="summary-column">
              <div class="summary-column__header">
                <h4>Inteligencia e cobertura</h4>
                <p>Confirma se a comparacao tem dados suficientes.</p>
              </div>
              <div class="status-list">
                <article class="status-item status-item--${migrationReadiness.llm.mode === 'live' ? 'positive' : 'warning'}">
                  <strong>${escapeHtml(
                    migrationReadiness.llm.mode === 'live' ? 'Provider real' : 'Fallback ativo',
                  )}</strong>
                  <p>${escapeHtml(`${migrationReadiness.llm.effectiveProvider} / ${migrationReadiness.llm.effectiveModel}`)}</p>
                </article>
                <article class="status-item status-item--${migrationReadiness.cutoverDecisionReady ? 'positive' : 'warning'}">
                  <strong>${escapeHtml(
                    migrationReadiness.cutoverDecisionReady ? 'Pronto para decidir' : 'Ainda em comparacao',
                  )}</strong>
                  <p>${escapeHtml(
                    `${migrationReadiness.lumeHubState.importedScheduleEvents} eventos, ${migrationReadiness.lumeHubState.alertRules} alerts e ${migrationReadiness.lumeHubState.automationDefinitions} automations no runtime novo.`,
                  )}</p>
                </article>
              </div>
            </div>
          </div>
          <details class="ui-details">
            <summary>Ver checklist detalhada</summary>
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
        <article class="surface content-card span-5">
          <div class="card-header">
            <div>
              <h3>Validacao avancada</h3>
              <p>Comparativos internos e shadow mode ficam recolhidos para nao poluir o fluxo principal.</p>
            </div>
            ${renderUiBadge({ label: 'So para operador', tone: 'warning' })}
          </div>
          <details class="ui-details">
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
          <details class="ui-details">
            <summary>Shadow mode: o que fazer durante a semana paralela</summary>
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
        <article class="surface content-card span-12">
          <div class="card-header">
            <div>
              <h3>Tokens do Codex vivem noutra pagina</h3>
              <p>A migracao mostra apenas se ha router disponivel. Trocar, preparar ou fixar tokens deve acontecer no Codex Router.</p>
            </div>
            ${renderUiBadge({ label: authRouterStatus ? visibleTokenLabel : 'Indisponivel', tone: authRouterStatus ? 'neutral' : 'warning' })}
          </div>
          <div class="action-row">
            ${renderUiActionButton({ label: 'Abrir Codex Router', href: '/codex-router', dataAttributes: { route: '/codex-router' } })}
          </div>
        </article>
      </section>

      ${this.renderLegacyMigrationTools(page.data)}
    `;
  }

  private renderCodexRouterPage(page: UiPage<CodexRouterPageData>): string {
    const snapshot = page.data.settings;
    const authRouterStatus = snapshot.authRouterStatus;
    const routerEnabledLabel = authRouterStatus ? readCodexRouterEnabledLabel(authRouterStatus.enabled) : 'Indisponivel';
    const activeTokenLabel = authRouterStatus?.currentSelection?.label ?? 'A rever';
    const visibleTokenLabel = readCodexTokenCountLabel(authRouterStatus?.accountCount ?? 0);
    const routerTone: UiTone = authRouterStatus ? (authRouterStatus.enabled ? 'positive' : 'warning') : 'warning';

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Codex Router</p>
          <h2>Troca tokens do Codex com travoes claros e backup antes de mexer.</h2>
          <p>Esta pagina serve so para gerir a auth do Codex. O LumeHub continua na configuracao base e os imports legacy ficam fora do menu principal.</p>
          <div class="action-row">
            ${renderUiActionButton({ label: 'Abrir LumeHub', href: '/settings', dataAttributes: { route: '/settings' } })}
            ${renderUiActionButton({ label: 'Abrir LLM', href: '/assistant', variant: 'secondary', dataAttributes: { route: '/assistant' } })}
          </div>
        </div>
        <div class="hero-panel">
          <div class="status-list">
            <article class="status-item status-item--${routerTone}">
              <strong>Modo de troca</strong>
              <p>${escapeHtml(
                authRouterStatus
                  ? authRouterStatus.enabled
                    ? 'Ligado: o Codex pode escolher o token mais seguro quando precisa.'
                    : 'Desligado: o token atual fica fixo ate voltares a ligar.'
                  : 'A gestao de tokens nao esta disponivel neste runtime.',
              )}</p>
            </article>
            <article class="status-item status-item--${authRouterStatus?.currentSelection ? 'positive' : 'warning'}">
              <strong>Token em uso</strong>
              <p>${escapeHtml(activeTokenLabel)}</p>
            </article>
            <article class="status-item status-item--positive">
              <strong>Backup antes de trocar</strong>
              <p>${escapeHtml(
                authRouterStatus
                  ? `Antes de preparar ou trocar, o router preserva a auth atual. ${visibleTokenLabel} conhecidos.`
                  : 'Quando o router estiver disponivel, a troca passa pelo mesmo contrato de backup.',
              )}</p>
            </article>
          </div>
        </div>
      </section>

      ${this.renderCodexRouterSurface(snapshot)}
    `;
  }

  private renderCodexRouterSurface(snapshot: SettingsSnapshot): string {
    const authRouterStatus = snapshot.authRouterStatus;
    const activeAccount = authRouterStatus?.currentSelection?.accountId ?? null;
    const visibleTokenCount = authRouterStatus?.accountCount ?? 0;
    const visibleTokenLabel = readCodexTokenCountLabel(visibleTokenCount);
    const routerEnabledLabel = authRouterStatus ? readCodexRouterEnabledLabel(authRouterStatus.enabled) : 'Indisponivel';
    const activeTokenLabel = authRouterStatus?.currentSelection?.label ?? 'A rever';
    const routerTone: UiTone = authRouterStatus ? (authRouterStatus.enabled ? 'positive' : 'warning') : 'warning';

    return `
      <section class="content-grid">
        <article class="surface content-card span-5">
          <div class="card-header">
            <div>
              <h3>Operacao segura</h3>
              <p>Comeca aqui: ligar/desligar a troca, atualizar estado ou pedir ao router para escolher o melhor token.</p>
            </div>
            ${renderUiBadge({
              label: routerEnabledLabel,
              tone: authRouterStatus ? (authRouterStatus.enabled ? 'positive' : 'warning') : 'warning',
            })}
          </div>
          ${
            authRouterStatus
              ? `
                  <div class="guide-preview">
                    <p><strong>Troca automatica</strong>: ${escapeHtml(routerEnabledLabel)}</p>
                    <p><strong>Token em uso</strong>: ${escapeHtml(activeTokenLabel)}</p>
                    <p><strong>Tokens prontos</strong>: ${escapeHtml(visibleTokenLabel)}</p>
                    <p><strong>Contrato de seguranca</strong>: antes de mudar, faz backup da auth canonica atual.</p>
                  </div>
                  <div class="action-row">
                    ${renderUiActionButton({
                      label: 'Atualizar estado',
                      variant: 'secondary',
                      dataAttributes: { 'settings-action': 'refresh-settings-surface' },
                    })}
                    ${renderUiActionButton({
                      label: authRouterStatus.enabled ? 'Desligar troca' : 'Ligar troca',
                      variant: authRouterStatus.enabled ? 'secondary' : 'primary',
                      dataAttributes: {
                        'settings-action': 'toggle-codex-router-enabled',
                        'codex-router-enabled': authRouterStatus.enabled ? 'true' : 'false',
                      },
                    })}
                    ${renderUiActionButton({
                      label: 'Escolher melhor token',
                      disabled: !authRouterStatus.enabled,
                      dataAttributes: { 'settings-action': 'prepare-codex-router' },
                    })}
                  </div>
                  <div class="guide-preview">
                    <p><strong>Ultima troca</strong>: ${escapeHtml(formatShortDateTime(authRouterStatus.lastSwitchAt))}</p>
                    <p>Se nao tens a certeza do que fazer, deixa a troca ligada e usa "Escolher melhor token". A escolha manual fica no bloco seguinte.</p>
                  </div>
                  <div class="summary-grid">
                    <div class="summary-column">
                      <div class="summary-column__header">
                        <h4>Estado do router</h4>
                        <p>Decide se o Codex pode ou nao trocar sozinho.</p>
                      </div>
                      <div class="status-list">
                        <article class="status-item status-item--${routerTone}">
                          <strong>${escapeHtml(routerEnabledLabel)}</strong>
                          <p>${escapeHtml(
                            authRouterStatus.enabled
                              ? 'O Codex pode mudar sozinho para o melhor token.'
                              : 'O token em uso fica fixo ate voltares a ligar a troca.',
                          )}</p>
                        </article>
                        <article class="status-item status-item--${
                          authRouterStatus.currentSelection ? 'positive' : 'warning'
                        }">
                          <strong>${escapeHtml(activeTokenLabel)}</strong>
                          <p>${escapeHtml(
                            authRouterStatus.currentSelection
                              ? 'Este e o token canonico em uso pelo Codex.'
                              : 'Ainda nao ha um token escolhido.',
                          )}</p>
                        </article>
                      </div>
                    </div>
                    <div class="summary-column">
                      <div class="summary-column__header">
                        <h4>Saude recente</h4>
                        <p>Mostra quantos tokens estao prontos e se houve falha recente.</p>
                      </div>
                      <div class="status-list">
                        <article class="status-item status-item--${
                          authRouterStatus.accountCount > 0 ? 'positive' : 'warning'
                        }">
                          <strong>${escapeHtml(`${visibleTokenCount} token(s) prontos`)}</strong>
                          <p>${escapeHtml(
                            authRouterStatus.accounts.length > 0
                              ? 'A lista pode ter 3, 4 ou mais tokens.'
                              : 'Ainda nao ha tokens conhecidos.',
                          )}</p>
                        </article>
                        <article class="status-item status-item--${authRouterStatus.lastError ? 'warning' : 'positive'}">
                          <strong>${escapeHtml(authRouterStatus.lastError ? 'Ultimo erro a rever' : 'Sem erro recente')}</strong>
                          <p>${escapeHtml(authRouterStatus.lastError ?? 'Sem erro recente registado pelo router.')}</p>
                        </article>
                      </div>
                    </div>
                  </div>
                  <details class="ui-details">
                    <summary>Ver detalhe tecnico</summary>
                    <div class="ui-details__content">
                      <p><strong>Auth canonica</strong>: ${escapeHtml(authRouterStatus.canonicalAuthFilePath)}</p>
                      <p><strong>Pasta de backups</strong>: ${escapeHtml(authRouterStatus.backupDirectoryPath)}</p>
                      <p><strong>Ultimo prepare</strong>: ${escapeHtml(formatShortDateTime(authRouterStatus.lastPreparedAt))}</p>
                      <p><strong>Auth pronta</strong>: ${escapeHtml(authRouterStatus.canonicalExists ? 'Pronta' : 'Em falta')}</p>
                      <ul>
                        ${
                          authRouterStatus.switchHistory.length > 0
                            ? authRouterStatus.switchHistory
                                .slice()
                                .reverse()
                                .slice(0, 8)
                                .map(
                                  (entry) =>
                                    `<li>${escapeHtml(formatShortDateTime(entry.createdAt))} · ${escapeHtml(entry.label ?? entry.accountId ?? 'sem token')} · ${escapeHtml(entry.event)}${entry.reason ? ` · ${escapeHtml(entry.reason)}` : ''}</li>`,
                                )
                                .join('')
                            : '<li>Sem historico recente de prepare ou troca.</li>'
                        }
                      </ul>
                    </div>
                  </details>
                `
              : `
                  <div class="inline-empty inline-empty--warning">
                    <strong>Gestao de tokens indisponivel</strong>
                    <p>A gestao de tokens do Codex nao esta configurada neste runtime.</p>
                  </div>
                `
          }
        </article>
        <article class="surface content-card span-7">
          <div class="card-header">
            <div>
              <h3>Escolha manual de token</h3>
              <p>So abre isto quando queres fixar uma conta especifica. A lista aceita 3, 4 ou mais tokens.</p>
            </div>
            ${renderUiBadge({
              label: readCodexTokenCountLabel(authRouterStatus?.accounts.length ?? 0),
              tone: authRouterStatus?.accounts.length ? 'neutral' : 'warning',
            })}
          </div>
          <details class="ui-details codex-router-token-details">
            <summary>Ver todos os tokens e escolher manualmente</summary>
            <div class="ui-details__content">
          ${
            authRouterStatus && authRouterStatus.accounts.length > 0
              ? `
                  <div class="codex-router-account-list">
                    ${authRouterStatus.accounts
                      .map(
                        (account) => {
                          const availability = readCodexTokenAvailability(account, activeAccount);

                          return `
                          <article class="codex-router-account-card">
                            <div class="card-header">
                              <div>
                                <h4>${escapeHtml(account.label)}</h4>
                                <p>${escapeHtml(describeCodexTokenRole(account))}</p>
                              </div>
                              <div class="codex-router-account-badges">
                                ${renderUiBadge({
                                  label: availability.label,
                                  tone: availability.tone,
                                })}
                                ${renderUiBadge({
                                  label: readCodexTokenKindLabel(account.kind),
                                  tone: account.kind === 'canonical_live' ? 'neutral' : 'warning',
                                  style: 'chip',
                                })}
                              </div>
                            </div>
                            <div class="guide-preview">
                              <p><strong>Estado</strong>: ${escapeHtml(availability.summary)}</p>
                              <p><strong>Uso livre</strong>: ${escapeHtml(readCodexQuotaSummary(account))}</p>
                              <p><strong>Ultimo sucesso</strong>: ${escapeHtml(formatShortDateTime(account.usage.lastSuccessAt))}</p>
                              <p><strong>Ultima falha</strong>: ${escapeHtml(
                                account.usage.lastFailureReason
                                  ? `${formatShortDateTime(account.usage.lastFailureAt)} · ${account.usage.lastFailureReason}`
                                  : formatShortDateTime(account.usage.lastFailureAt),
                              )}</p>
                            </div>
                            ${renderCodexQuotaMeter(account)}
                            <div class="action-row">
                              ${renderUiActionButton({
                                label: account.accountId === activeAccount ? 'Token em uso' : 'Usar este token',
                                variant: account.accountId === activeAccount ? 'secondary' : 'primary',
                                disabled: !authRouterStatus.enabled || !account.exists || account.accountId === activeAccount,
                                dataAttributes: {
                                  'settings-action': 'switch-codex-account',
                                  'codex-account-id': account.accountId,
                                },
                              })}
                            </div>
                            <details class="ui-details">
                              <summary>Ver diagnostico tecnico</summary>
                              <div class="ui-details__content">
                                <ul>
                                  <li><strong>Origem</strong>: ${escapeHtml(account.sourceFilePath)}</li>
                                  <li><strong>Prioridade</strong>: ${account.priority}</li>
                                  <li><strong>Sucessos</strong>: ${account.usage.successCount} · <strong>Falhas</strong>: ${account.usage.failureCount}</li>
                                  <li><strong>Cooldown</strong>: ${escapeHtml(formatShortDateTime(account.usage.cooldownUntil))}</li>
                                  <li><strong>Limites lidos</strong>: ${escapeHtml(formatShortDateTime(account.quota?.checkedAt ?? null))}</li>
                                  <li><strong>Diagnostico de limites</strong>: ${escapeHtml(account.quota?.fetchError ?? 'Sem erro na ultima leitura.')}</li>
                                </ul>
                              </div>
                            </details>
                          </article>
                        `;
                        },
                      )
                      .join('')}
                  </div>
                `
              : `
                  <div class="inline-empty">
                    <strong>Sem tokens conhecidos</strong>
                    <p>Assim que o router carregar contas, esta area passa a listar todos os tokens disponiveis.</p>
                  </div>
                `
          }
            </div>
          </details>
        </article>
      </section>
    `;
  }

  private renderLegacyMigrationTools(pageData: MigrationPageData): string {
    const snapshot = pageData.settings;
    const legacyFiles = pageData.legacyScheduleImportFiles;
    const draft = resolveLegacyScheduleMigrationDraft(
      this.state.legacyScheduleMigrationDraft,
      legacyFiles,
      pageData.legacyScheduleImportReport,
    );
    const alertDraft = resolveLegacyAlertMigrationDraft(
      this.state.legacyAlertMigrationDraft,
      pageData.legacyAlertImportReport,
    );
    const automationDraft = resolveLegacyAutomationMigrationDraft(
      this.state.legacyAutomationMigrationDraft,
      pageData.legacyAutomationImportReport,
    );
    const selectedLegacyFile = legacyFiles.find((file) => file.fileName === draft.fileName) ?? legacyFiles[0] ?? null;
    const alertRulesCount = snapshot.adminSettings.alerts.rules.length;
    const automationDefinitionsCount = snapshot.adminSettings.automations.definitions.length;

    return `
      <section class="content-grid">
        <article class="surface content-card span-12">
          <div class="card-header">
            <div>
              <h3>Ferramentas de operador</h3>
              <p>Previews e aplicacao real ficam recolhidos. Abre so o bloco que precisas de executar.</p>
            </div>
            ${renderUiBadge({ label: 'Migracao', tone: 'warning' })}
          </div>
          <details class="ui-details">
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
                        <p><strong>Modo</strong>: ${escapeHtml(draft.report.mode === 'apply' ? 'Import aplicado' : 'Preview')}</p>
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
                    ${pageData.recentAlertMatches.length > 0
                      ? pageData.recentAlertMatches
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
                    ${pageData.recentAutomationRuns.length > 0
                      ? pageData.recentAutomationRuns
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

  private renderSettingsPage(page: UiPage<SettingsPageData>): string {
    const snapshot = page.data.settings;
    const people = buildSettingsPeopleViews(page.data.people, snapshot);
    const enabledCommandSettings = PRODUCT_COMMAND_SETTING_KEYS.filter((key) => snapshot.adminSettings.commands[key]).length;
    const defaultRuleSummary =
      snapshot.adminSettings.ui.defaultNotificationRules.length > 0
        ? snapshot.adminSettings.ui.defaultNotificationRules
            .map((rule) => rule.label ?? rule.kind)
            .slice(0, 3)
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
    const appOwnerCount = people.filter((person) => person.globalRoles.includes('app_owner')).length;
    const privateAuthorizedCount = people.filter((person) => person.privateAssistantAuthorized).length;
    const llmAuthLabel = readCodexAuthLabel(snapshot);
    const powerMode = snapshot.powerStatus.policy.mode;
    const activePowerModeLabel = readPowerModeLabel(powerMode);
    const currentDefaultRules =
      snapshot.adminSettings.ui.defaultNotificationRules.length > 0
        ? snapshot.adminSettings.ui.defaultNotificationRules
        : createCanonicalDefaultNotificationRules();
    const authRouterStatus = snapshot.authRouterStatus;
    const routerEnabledLabel = authRouterStatus ? readCodexRouterEnabledLabel(authRouterStatus.enabled) : 'Indisponivel';
    const routerTone: UiTone = authRouterStatus ? (authRouterStatus.enabled ? 'positive' : 'warning') : 'warning';
    const visibleTokenLabel = readCodexTokenCountLabel(authRouterStatus?.accountCount ?? 0);
    const hostRuntimeTone: UiTone = snapshot.hostStatus.runtime.lastError ? 'warning' : 'positive';

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">LumeHub</p>
          <h2>Painel base do produto: regras globais e saude operacional sem ruido tecnico.</h2>
          <p>Esta pagina e para operar o produto. WhatsApp e Codex Router ficam separados para cada pessoa perceber onde deve mexer.</p>
          <div class="action-row">
            ${renderUiActionButton({ label: 'Ver grupos', href: '/groups', dataAttributes: { route: '/groups' } })}
            ${renderUiActionButton({ label: 'Abrir WhatsApp', href: '/whatsapp', variant: 'secondary', dataAttributes: { route: '/whatsapp' } })}
            ${renderUiActionButton({ label: 'Abrir Codex Router', href: '/codex-router', variant: 'secondary', dataAttributes: { route: '/codex-router' } })}
          </div>
        </div>
        <div class="hero-panel">
          <div class="status-list">
            <article class="status-item status-item--positive">
              <strong>Basico</strong>
              <p>Controlos de produto, leitura de saude e proximos caminhos.</p>
            </article>
            <article class="status-item status-item--warning">
              <strong>Avancado</strong>
              <p>Provider LLM, energia, tokens, auth e governanca ficam recolhidos abaixo.</p>
            </article>
          </div>
        </div>
      </section>
      <section class="surface content-card">
        <div class="card-header">
          <div>
            <h3>Basico: leitura rapida</h3>
            <p>O essencial para uma pessoa pouco tecnica perceber se o produto esta pronto para usar.</p>
          </div>
          ${renderUiBadge({ label: `${enabledCommandSettings} regras ativas`, tone: enabledCommandSettings > 0 ? 'positive' : 'warning' })}
        </div>
        <div class="summary-grid">
          <div class="summary-column">
            <div class="summary-column__header">
              <h4>Regras globais</h4>
              <p>O que a app pode fazer de forma transversal.</p>
            </div>
            <div class="status-list">
              <article class="status-item status-item--${enabledCommandSettings > 0 ? 'positive' : 'warning'}">
                <strong>${escapeHtml(`${enabledCommandSettings}/${PRODUCT_COMMAND_SETTING_KEYS.length} regras ligadas`)}</strong>
                <p>Controlos ativos agora, antes das regras por grupo.</p>
              </article>
            </div>
          </div>
          <div class="summary-column">
            <div class="summary-column__header">
              <h4>Saude operacional</h4>
              <p>Se ha sinal recente e se existe algum erro visivel.</p>
            </div>
            <div class="status-list">
              <article class="status-item status-item--${hostRuntimeTone}">
                <strong>${escapeHtml(snapshot.hostStatus.runtime.lastError ? 'A rever' : 'Sem erro recente')}</strong>
                <p>${escapeHtml(snapshot.hostStatus.runtime.lastError ?? `Ultimo sinal: ${formatShortDateTime(snapshot.hostStatus.runtime.lastHeartbeatAt)}`)}</p>
              </article>
            </div>
          </div>
          <div class="summary-column">
            <div class="summary-column__header">
              <h4>Caminhos certos</h4>
              <p>Cada assunto tem uma pagina propria.</p>
            </div>
            <div class="status-list">
              <article class="status-item">
                <strong>Separacao por papel</strong>
                <p>Canal no WhatsApp e tokens no Codex Router. Imports legacy ficam arquivados fora do menu principal.</p>
              </article>
            </div>
          </div>
        </div>
      </section>
      <section class="content-grid">
        <article class="surface content-card span-7">
          <div class="card-header">
            <div>
              <h3>Regras globais</h3>
              <p>Estes switches mandam no que a app pode fazer de forma transversal, antes de qualquer detalhe por grupo.</p>
            </div>
            ${renderUiBadge({ label: `${enabledCommandSettings} ativos`, tone: enabledCommandSettings > 0 ? 'positive' : 'warning' })}
          </div>
          <div class="settings-switch-grid">
            ${PRODUCT_COMMAND_SETTING_KEYS.map((key) =>
              renderUiSwitch({
                label: readCommandSettingLabel(key),
                checked: snapshot.adminSettings.commands[key],
                description: readCommandSettingDescription(key, snapshot.adminSettings.commands[key]),
                dataAttributes: {
                  'settings-action': 'toggle-command-setting',
                  'command-setting': key,
                },
              }),
            ).join('')}
          </div>
          <div class="inline-empty">
            <strong>Nao mexe em</strong>
            <p>WhatsApp continua a tratar sessao, QR, auth e discovery. Os grupos continuam a tratar owner, modo local e policy de tag.</p>
          </div>
        </article>

        <article class="surface content-card span-5">
          <div class="card-header">
            <div>
              <h3>Saude operacional</h3>
              <p>Sem detalhes de provider: so o suficiente para perceber se a instalacao parece pronta.</p>
            </div>
            ${renderUiBadge({ label: snapshot.hostStatus.runtime.lastError ? 'A rever' : 'Estavel', tone: hostRuntimeTone })}
          </div>
          <ul class="settings-summary-list">
            <li><strong>Ultimo sinal</strong>: ${escapeHtml(formatShortDateTime(snapshot.hostStatus.runtime.lastHeartbeatAt))}</li>
            <li><strong>Avisos base</strong>: ${escapeHtml(defaultRuleSummary)}</li>
            <li><strong>Owners</strong>: ${escapeHtml(`${appOwnerCount} owner(s) definidos`)}</li>
            <li><strong>Privado autorizado</strong>: ${escapeHtml(`${privateAuthorizedCount} contacto(s)`)}</li>
          </ul>
          <div class="inline-empty">
            <strong>Onde mexer se algo falhar</strong>
            <p>WhatsApp trata sessao e Codex Router trata tokens. Os detalhes avancados ficam abaixo.</p>
          </div>
        </article>
      </section>

      <details class="surface content-card settings-advanced-details">
        <summary>Avancado: LLM, energia, tokens, avisos e governanca</summary>
        <div class="ui-details__content settings-advanced-stack">
          <section class="content-grid">
            <article class="surface content-card span-6">
              <div class="card-header">
                <div>
                  <h3>LLM, energia e arranque</h3>
                  <p>Provider, auth, power policy e autostart ficam aqui para nao pesar na vista base.</p>
                </div>
                ${renderUiBadge({ label: llmStatusLabel, tone: llmTone })}
              </div>
              <div class="settings-switch-grid">
                ${PRODUCT_LLM_SETTING_KEYS.map((key) =>
                  renderUiSwitch({
                    label: readLlmSettingLabel(key),
                    checked: snapshot.adminSettings.llm[key],
                    description: readLlmSettingDescription(key, snapshot.adminSettings.llm[key]),
                    dataAttributes: {
                      'settings-action': 'toggle-llm-setting',
                      'llm-setting': key,
                    },
                  }),
                ).join('')}
              </div>
              <ul class="settings-summary-list">
                <li><strong>Definido</strong>: ${escapeHtml(snapshot.adminSettings.llm.provider)} / ${escapeHtml(snapshot.adminSettings.llm.model)}</li>
                <li><strong>Agora</strong>: ${escapeHtml(snapshot.llmRuntime.effectiveProviderId)} / ${escapeHtml(snapshot.llmRuntime.effectiveModelId)}</li>
                <li><strong>Codex</strong>: ${escapeHtml(llmAuthLabel)}</li>
                <li><strong>Energia</strong>: ${escapeHtml(activePowerModeLabel)}${snapshot.powerStatus.policy.enabled ? '' : ' (policy desligada)'}</li>
                <li><strong>Ultimo sinal</strong>: ${escapeHtml(formatShortDateTime(snapshot.hostStatus.runtime.lastHeartbeatAt))}</li>
                ${
                  snapshot.llmRuntime.fallbackReason
                    ? `<li><strong>Fallback</strong>: ${escapeHtml(snapshot.llmRuntime.fallbackReason)}</li>`
                    : ''
                }
              </ul>
              <div class="settings-mode-actions">
                ${renderUiActionButton({
                  label: snapshot.powerStatus.policy.enabled ? 'Desligar policy de energia' : 'Ligar policy de energia',
                  variant: snapshot.powerStatus.policy.enabled ? 'secondary' : 'primary',
                  dataAttributes: { 'settings-action': 'toggle-power-enabled' },
                })}
                ${PRODUCT_POWER_MODES.map((mode) =>
                  renderUiActionButton({
                    label: readPowerModeLabel(mode),
                    variant: mode === powerMode ? 'primary' : 'secondary',
                    disabled: mode === powerMode,
                    dataAttributes: {
                      'settings-action': 'set-power-mode',
                      'power-mode': mode,
                    },
                  }),
                ).join('')}
                ${renderUiActionButton({
                  label: snapshot.hostStatus.autostart.enabled ? 'Desligar autostart' : 'Ligar autostart',
                  variant: 'secondary',
                  dataAttributes: { 'settings-action': 'toggle-autostart' },
                })}
              </div>
              ${
                this.state.advancedDetailsEnabled
                  ? `
                      <details class="ui-details">
                        <summary>Ver detalhe tecnico do host</summary>
                        <div class="ui-details__content">
                          <p>Auth file: ${escapeHtml(snapshot.hostStatus.auth.filePath)}</p>
                          <p>Service: ${escapeHtml(snapshot.hostStatus.autostart.serviceName)}</p>
                          <p>Manifesto: ${escapeHtml(snapshot.hostStatus.autostart.manifestPath)}</p>
                        </div>
                      </details>
                    `
                  : ''
              }
            </article>

            <article class="surface content-card span-6">
              <div class="card-header">
                <div>
                  <h3>Codex Router nesta instalacao</h3>
                  <p>Resumo e botoes de emergencia. A gestao completa continua na pagina Codex Router.</p>
                </div>
                ${renderUiBadge({ label: routerEnabledLabel, tone: routerTone })}
              </div>
              ${
                authRouterStatus
                  ? `
                      <div class="guide-preview">
                        <p><strong>Troca de token</strong>: ${escapeHtml(routerEnabledLabel)}</p>
                        <p><strong>Tokens prontos</strong>: ${escapeHtml(visibleTokenLabel)}</p>
                        <p><strong>Backup</strong>: antes de preparar ou trocar, o router preserva a auth atual.</p>
                      </div>
                      <div class="action-row">
                        ${renderUiActionButton({
                          label: authRouterStatus.enabled ? 'Desligar troca de token' : 'Ligar troca de token',
                          variant: authRouterStatus.enabled ? 'secondary' : 'primary',
                          dataAttributes: {
                            'settings-action': 'toggle-codex-router-enabled',
                            'codex-router-enabled': authRouterStatus.enabled ? 'true' : 'false',
                          },
                        })}
                        ${renderUiActionButton({
                          label: 'Abrir Codex Router',
                          href: '/codex-router',
                          variant: 'secondary',
                          dataAttributes: { route: '/codex-router' },
                        })}
                      </div>
                    `
                  : `
                      <div class="inline-empty inline-empty--warning">
                        <strong>Codex Router indisponivel</strong>
                        <p>A gestao de tokens nao esta configurada neste runtime.</p>
                      </div>
                    `
              }
            </article>
          </section>

          <section class="content-grid">
        <article class="surface content-card span-6">
          <div class="card-header">
            <div>
              <h3>Avisos por defeito</h3>
              <p>Os avisos base do calendario vivem aqui e sao reaproveitados pelas criacoes manuais e assistidas.</p>
            </div>
            ${renderUiBadge({
              label: `${currentDefaultRules.length} regra(s)`,
              tone: currentDefaultRules.length > 0 ? 'positive' : 'warning',
            })}
          </div>
          <ul class="settings-summary-list">
            ${currentDefaultRules
              .map(
                (rule) =>
                  `<li><strong>${escapeHtml(rule.label ?? rule.kind)}</strong>: ${escapeHtml(
                    rule.localTime ?? `${rule.daysBeforeEvent ?? 0}d / ${rule.offsetMinutesBeforeEvent ?? 0}m`,
                  )}</li>`,
              )
              .join('')}
          </ul>
          <div class="action-row">
            ${renderUiActionButton({
              label: 'Repor defaults canonicos',
              variant: 'secondary',
              dataAttributes: { 'settings-action': 'restore-default-notification-rules' },
            })}
          </div>
          <div class="inline-empty">
            <strong>Imports legacy fechados</strong>
            <p>Schedules e alerts do WA-Notify ja foram absorvidos pelo LumeHub; a consola de migracao saiu do menu normal.</p>
          </div>
        </article>

        <article class="surface content-card span-6">
          <div class="card-header">
            <div>
              <h3>Donos da app e privados</h3>
              <p>App owners e permissao de privado vivem aqui, porque sao decisoes de produto e nao do canal.</p>
            </div>
            ${renderUiBadge({ label: `${people.length} pessoa(s)`, tone: people.length > 0 ? 'neutral' : 'warning' })}
          </div>
          ${
            people.length > 0
              ? `
                  <div class="settings-governance-list">
                    ${people
                      .map(
                        (person) => `
                          <article class="settings-governance-item">
                            <div class="settings-governance-item__header">
                              <div>
                                <strong>${escapeHtml(person.displayName)}</strong>
                                <p>${escapeHtml(
                                  person.whatsappJids.length > 0
                                    ? `${person.whatsappJids.length} contacto(s) WhatsApp conhecido(s)`
                                    : 'Sem contacto WhatsApp mapeado',
                                )}</p>
                              </div>
                              <div class="ui-card__chips">
                                ${renderUiBadge({
                                  label: person.globalRoles.includes('app_owner') ? 'App owner' : 'Membro',
                                  tone: person.globalRoles.includes('app_owner') ? 'positive' : 'neutral',
                                  style: 'chip',
                                })}
                                ${renderUiBadge({
                                  label: person.privateAssistantAuthorized ? 'Privado permitido' : 'Privado bloqueado',
                                  tone: person.privateAssistantAuthorized ? 'positive' : 'warning',
                                  style: 'chip',
                                })}
                              </div>
                            </div>
                            <div class="action-row">
                              ${renderUiActionButton({
                                label: person.globalRoles.includes('app_owner') ? 'Remover app owner' : 'Tornar app owner',
                                variant: person.globalRoles.includes('app_owner') ? 'secondary' : 'primary',
                                dataAttributes: {
                                  'settings-action': 'toggle-app-owner',
                                  'person-id': person.personId ?? '',
                                },
                              })}
                              ${
                                person.whatsappJids.length > 0
                                  ? renderUiActionButton({
                                      label: person.privateAssistantAuthorized ? 'Bloquear privado' : 'Permitir privado',
                                      variant: 'secondary',
                                      dataAttributes: {
                                        'settings-action': 'toggle-private-person',
                                        'person-id': person.personId ?? '',
                                      },
                                    })
                                  : ''
                              }
                            </div>
                          </article>
                        `,
                      )
                      .join('')}
                  </div>
                `
              : `
                  <div class="inline-empty">
                    <strong>Sem pessoas conhecidas</strong>
                    <p>Assim que o runtime reconhecer identidades, esta pagina passa a gerir app owners e privados globais aqui.</p>
                  </div>
                `
          }
            </article>
          </section>
        </div>
      </details>
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
      readonly kind: 'mode' | 'preview' | 'route';
    }[],
    eyebrow = 'Estado global',
  ): string {
    return `
      <section class="surface state-card">
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
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
                  : action.kind === 'route'
                    ? renderUiActionButton({
                        label: action.label,
                        variant: 'secondary',
                        href: action.value,
                        dataAttributes: { route: action.value },
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

  private renderLoadingStateCard(currentRoute: ResolvedAppRoute): string {
    const title =
      currentRoute.canonicalRoute === '/today' ? 'A abrir a homepage do LumeHub' : `A abrir ${currentRoute.label}`;
    const description =
      currentRoute.canonicalRoute === '/today'
        ? 'Estamos a carregar o estado mais recente do produto para te mostrar o que esta bem, o que pede atencao e o proximo passo.'
        : `Estamos a carregar ${currentRoute.label} com os dados mais recentes desta instalacao. Se isto demorar demais, tenta outra vez ou abre o demo para continuares a navegar.`;

    return `
      <section class="surface state-card">
        <div>
          <p class="eyebrow">A preparar</p>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(description)}</p>
          <div class="action-row">
            ${renderUiActionButton({
              label: 'Tentar outra vez',
              variant: 'secondary',
              dataAttributes: { preview: 'none' },
            })}
            ${renderUiActionButton({
              label: 'Abrir demo',
              dataAttributes: { mode: 'demo' },
            })}
          </div>
        </div>
        <div class="skeleton" aria-hidden="true">
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

  private updateGuidedField(fieldKey: string, value: string): void {
    const reminderMatch = /^group\.reminder\.(\d+)\.(label|timingMode|offsetMinutes|localTime|messageTemplate|llmPromptTemplate)$/u.exec(
      fieldKey,
    );

    if (reminderMatch) {
      const reminderIndex = Number.parseInt(reminderMatch[1] ?? '', 10);
      const reminderField = reminderMatch[2] as keyof GroupReminderDraft;

      this.state = {
        ...this.state,
        flowFeedback: null,
        groupManagementDraft: {
          ...this.state.groupManagementDraft,
          reminderPolicy: {
            ...this.state.groupManagementDraft.reminderPolicy,
            reminders: this.state.groupManagementDraft.reminderPolicy.reminders.map((reminder, index) =>
              index === reminderIndex
                ? {
                    ...reminder,
                    [reminderField]: value,
                  }
                : reminder,
            ),
          },
        },
      };
      this.render();
      return;
    }

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
            preview: null,
            lastApplied: null,
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
      const selectedGroup = page.data.groups.find((group) => group.groupJid === draft.groupJid) ?? null;

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

      if (!selectedGroup || !canGroupUseManualScheduling(selectedGroup)) {
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'warning',
            message: selectedGroup
              ? describeManualSchedulingState(selectedGroup)
              : 'Escolhe primeiro um grupo com calendario ativo antes de gravar.',
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
        page.data.groups.filter((group) => canGroupUseManualScheduling(group)),
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

      if (!canGroupUseManualScheduling(group)) {
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'warning',
            message: describeManualSchedulingState(group),
          },
        };
        this.render();
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

      const eventGroup = page.data.groups.find((group) => group.groupJid === event.groupJid) ?? null;

      if (!eventGroup || !canGroupUseManualScheduling(eventGroup)) {
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'warning',
            message: eventGroup
              ? `${describeManualSchedulingState(eventGroup)} Podes desativar este agendamento, mas nao reabri-lo para edicao aqui.`
              : 'Nao encontramos um grupo com agendamento ativo para este evento.',
          },
        };
        this.render();
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

  private readMigrationPageData(): UiPage<MigrationPageData> | null {
    const page = this.state.page as UiPage<MigrationPageData> | null;

    if (!page || page.route !== '/migration') {
      return null;
    }

    return page;
  }

  private readSettingsSurfacePage(): UiPage<SettingsPageData | MigrationPageData | CodexRouterPageData> | null {
    const page = this.state.page as UiPage<SettingsPageData | MigrationPageData | CodexRouterPageData> | null;

    if (!page || (page.route !== '/settings' && page.route !== '/migration' && page.route !== '/codex-router')) {
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
    const selectedGroup = page.data.groups.find((group) => group.groupJid === draft.groupJid) ?? null;

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

    if (!selectedGroup || !canGroupUseLlmScheduling(selectedGroup)) {
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'warning',
          message: selectedGroup
            ? describeAssistantSchedulingState(selectedGroup)
            : 'Escolhe primeiro um grupo com LLM scheduling ativo.',
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

    if (action === 'refresh-settings-surface') {
      const message =
        page.route === '/migration'
          ? 'A atualizar a semana paralela e o estado dos tokens do Codex.'
          : 'A atualizar o estado do Codex Router e dos tokens disponiveis.';

      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message,
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
          message: 'A escolher o melhor token disponivel no Codex.',
        },
      };
      this.render();

      try {
        const status = await this.currentClient().prepareCodexAuthRouter();
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'positive',
            message: `Pronto. O Codex ficou com ${status.currentSelection?.label ?? 'um token disponivel'}.`,
          },
        };
        this.recordUxEvent('positive', `Codex auto router preparado com ${status.currentSelection?.accountId ?? 'sem token'}.`);
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel escolher o melhor token do Codex. ${readErrorMessage(error)}`;
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

    if (action === 'toggle-codex-router-enabled') {
      const enabledRaw = String(dataset.codexRouterEnabled ?? '').trim().toLowerCase();
      const currentlyEnabled = enabledRaw === 'true';
      const nextEnabled = !currentlyEnabled;

      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: nextEnabled ? 'A ligar a troca automatica de tokens do Codex.' : 'A desligar a troca automatica de tokens do Codex.',
        },
      };
      this.render();

      try {
        const status = await this.currentClient().setCodexAuthRouterEnabled(nextEnabled);
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'positive',
            message: status.enabled ? 'A troca automatica de tokens ficou ligada.' : 'A troca automatica de tokens ficou desligada.',
          },
        };
        this.recordUxEvent(
          'positive',
          status.enabled ? 'Codex auto router ligado para troca de tokens.' : 'Codex auto router desligado para troca de tokens.',
        );
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel atualizar a troca automatica de tokens do Codex. ${readErrorMessage(error)}`;
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
            title: 'Trocar o token em uso do Codex?',
            description: 'Isto vai atualizar a auth canonica do Codex para o token escolhido.',
            confirmLabel: 'Trocar token',
            tone: 'warning',
          },
          flowFeedback: {
            tone: 'warning',
            message: 'Confirma primeiro a troca manual do token em uso do Codex.',
          },
        };
        this.render();
        return;
      }

      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: 'A trocar o token em uso do Codex neste runtime.',
        },
      };
      this.render();

      try {
        const status = await this.currentClient().forceCodexAuthSwitch(accountId);
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'positive',
            message: `Token em uso mudado para ${status.currentSelection?.label ?? accountId}.`,
          },
        };
        this.recordUxEvent('positive', `Codex auto router trocado para ${accountId}.`);
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel trocar o token do Codex. ${readErrorMessage(error)}`;
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

    if (action === 'toggle-command-setting') {
      const settingsPage = this.readSettingsPageData();

      if (!settingsPage) {
        return;
      }

      const setting = dataset.commandSetting;

      if (!setting || !isProductCommandSettingKey(setting)) {
        return;
      }

      const people = buildSettingsPeopleViews(settingsPage.data.people, settingsPage.data.settings);
      const pendingConfirmation = !options.confirmed
        ? this.buildSettingsConfirmation(action, dataset, settingsPage.data.settings, people)
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

      const nextValue = !settingsPage.data.settings.adminSettings.commands[setting];

      await this.runSettingsMutation(
        async () => {
          await this.currentClient().updateCommandSettings({
            [setting]: nextValue,
          } as Partial<typeof settingsPage.data.settings.adminSettings.commands>);
        },
        readCommandSettingMutationMessage(setting, nextValue),
      );
      return;
    }

    if (action === 'toggle-llm-setting') {
      const settingsPage = this.readSettingsPageData();

      if (!settingsPage) {
        return;
      }

      const setting = dataset.llmSetting;

      if (!setting || !isProductLlmSettingKey(setting)) {
        return;
      }

      const people = buildSettingsPeopleViews(settingsPage.data.people, settingsPage.data.settings);
      const pendingConfirmation = !options.confirmed
        ? this.buildSettingsConfirmation(action, dataset, settingsPage.data.settings, people)
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

      const nextValue = !settingsPage.data.settings.adminSettings.llm[setting];

      await this.runSettingsMutation(
        async () => {
          await this.currentClient().updateLlmSettings({
            [setting]: nextValue,
          } as Partial<typeof settingsPage.data.settings.adminSettings.llm>);
        },
        readLlmSettingMutationMessage(setting, nextValue),
      );
      return;
    }

    if (action === 'toggle-power-enabled') {
      const settingsPage = this.readSettingsPageData();

      if (!settingsPage) {
        return;
      }

      const nextValue = !settingsPage.data.settings.powerStatus.policy.enabled;

      await this.runSettingsMutation(
        async () => {
          await this.currentClient().updatePowerPolicy({
            enabled: nextValue,
          });
        },
        nextValue
          ? 'A policy de energia ficou ligada no host companion.'
          : 'A policy de energia ficou desligada no host companion.',
      );
      return;
    }

    if (action === 'set-power-mode') {
      const settingsPage = this.readSettingsPageData();

      if (!settingsPage) {
        return;
      }

      const mode = dataset.powerMode;

      if (!mode || !isProductPowerMode(mode) || mode === settingsPage.data.settings.powerStatus.policy.mode) {
        return;
      }

      await this.runSettingsMutation(
        async () => {
          await this.currentClient().updatePowerPolicy({
            mode,
          });
        },
        `A policy de energia ficou em ${readPowerModeLabel(mode)}.`,
      );
      return;
    }

    if (action === 'toggle-autostart') {
      const settingsPage = this.readSettingsPageData();

      if (!settingsPage) {
        return;
      }

      const nextValue = !settingsPage.data.settings.hostStatus.autostart.enabled;

      await this.runSettingsMutation(
        async () => {
          await this.currentClient().setAutostartEnabled(nextValue);
        },
        nextValue
          ? 'O autostart do host companion ficou ligado.'
          : 'O autostart do host companion ficou desligado.',
      );
      return;
    }

    if (action === 'restore-default-notification-rules') {
      await this.runSettingsMutation(
        async () => {
          await this.currentClient().updateDefaultNotificationRules(createCanonicalDefaultNotificationRules());
        },
        'Os defaults canonicos de notificacao foram repostos.',
      );
      return;
    }

    if (action === 'toggle-app-owner') {
      const settingsPage = this.readSettingsPageData();

      if (!settingsPage) {
        return;
      }

      const people = buildSettingsPeopleViews(settingsPage.data.people, settingsPage.data.settings);
      const pendingConfirmation = !options.confirmed
        ? this.buildSettingsConfirmation(action, dataset, settingsPage.data.settings, people)
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

      await this.runSettingsMutation(
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
      const settingsPage = this.readSettingsPageData();

      if (!settingsPage) {
        return;
      }

      const people = buildSettingsPeopleViews(settingsPage.data.people, settingsPage.data.settings);
      const pendingConfirmation = !options.confirmed
        ? this.buildSettingsConfirmation(action, dataset, settingsPage.data.settings, people)
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

      const personId = dataset.personId;
      const person = people.find((candidate) => candidate.personId === personId);

      if (!personId || !person || person.whatsappJids.length === 0) {
        return;
      }

      const knownPrivateJids = dedupeStringList(people.flatMap((candidate) => candidate.whatsappJids));
      const currentAuthorizedPrivateJids = resolveAuthorizedPrivateJidsForCommands(
        settingsPage.data.settings.adminSettings.commands,
        knownPrivateJids,
      );
      const nextAuthorizedPrivateJids = person.privateAssistantAuthorized
        ? currentAuthorizedPrivateJids.filter((chatJid) => !person.whatsappJids.includes(chatJid))
        : dedupeStringList([...currentAuthorizedPrivateJids, ...person.whatsappJids]);
      const nextAllowPrivateAssistant = nextAuthorizedPrivateJids.length > 0;

      await this.runSettingsMutation(
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

    const migrationPage = this.readMigrationPageData();

    if (!migrationPage) {
      return;
    }

    const draft = resolveLegacyScheduleMigrationDraft(
      this.state.legacyScheduleMigrationDraft,
      migrationPage.data.legacyScheduleImportFiles,
      migrationPage.data.legacyScheduleImportReport,
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
          requestedBy: 'migration-ui',
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
        requestedBy: 'migration-ui',
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

    if (action === 'toggle-reminder-policy-enabled') {
      this.state = {
        ...this.state,
        flowFeedback: null,
        groupManagementDraft: {
          ...this.state.groupManagementDraft,
          reminderPolicy: {
            ...this.state.groupManagementDraft.reminderPolicy,
            enabled: !this.state.groupManagementDraft.reminderPolicy.enabled,
          },
        },
      };
      this.render();
      return;
    }

    if (action === 'toggle-reminder-enabled') {
      const reminderIndex = Number.parseInt(dataset.reminderIndex ?? '', 10);

      if (!Number.isInteger(reminderIndex)) {
        return;
      }

      this.state = {
        ...this.state,
        flowFeedback: null,
        groupManagementDraft: {
          ...this.state.groupManagementDraft,
          reminderPolicy: {
            ...this.state.groupManagementDraft.reminderPolicy,
            reminders: this.state.groupManagementDraft.reminderPolicy.reminders.map((reminder, index) =>
              index === reminderIndex
                ? {
                    ...reminder,
                    enabled: !reminder.enabled,
                  }
                : reminder,
            ),
          },
        },
      };
      this.render();
      return;
    }

    if (action === 'add-reminder') {
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: 'Novo lembrete adicionado ao rascunho deste grupo.',
        },
        groupManagementDraft: {
          ...this.state.groupManagementDraft,
          reminderPolicy: {
            ...this.state.groupManagementDraft.reminderPolicy,
            reminders: [
              ...this.state.groupManagementDraft.reminderPolicy.reminders,
              createNextReminderDraft(this.state.groupManagementDraft.reminderPolicy.reminders.length),
            ],
          },
        },
      };
      this.render();
      return;
    }

    if (action === 'remove-reminder') {
      const reminderIndex = Number.parseInt(dataset.reminderIndex ?? '', 10);

      if (!Number.isInteger(reminderIndex)) {
        return;
      }

      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: 'Lembrete retirado deste rascunho.',
        },
        groupManagementDraft: {
          ...this.state.groupManagementDraft,
          reminderPolicy: {
            ...this.state.groupManagementDraft.reminderPolicy,
            reminders: this.state.groupManagementDraft.reminderPolicy.reminders.filter(
              (_reminder, index) => index !== reminderIndex,
            ),
          },
        },
      };
      this.render();
      return;
    }

    if (action === 'reset-reminder-policy') {
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: 'Os lembretes voltaram ao conjunto canonico desta ronda.',
        },
        groupManagementDraft: {
          ...this.state.groupManagementDraft,
          reminderPolicy: mapReminderPolicySnapshotToDraft(null),
        },
      };
      this.render();
      return;
    }

    if (action === 'save-reminder-policy') {
      const selectedGroupJid = this.state.groupManagementDraft.selectedGroupJid;

      if (!selectedGroupJid) {
        return;
      }

      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'neutral',
          message: 'A guardar a politica de lembretes deste grupo.',
        },
      };
      this.render();

      try {
        await this.currentClient().updateGroupReminderPolicy(
          selectedGroupJid,
          mapReminderPolicyDraftToPayload(this.state.groupManagementDraft.reminderPolicy),
        );
        this.recordUxEvent('positive', `Lembretes do grupo ${selectedGroupJid} guardados.`);
        this.state = {
          ...this.state,
          flowFeedback: {
            tone: 'positive',
            message: 'Lembretes guardados. Os novos eventos deste grupo passam a herdar estas regras.',
          },
        };
        await this.refreshCurrentRouteData();
      } catch (error) {
        const message = `Nao foi possivel guardar os lembretes. ${readErrorMessage(error)}`;
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

  private async runSettingsMutation(task: () => Promise<void>, successMessage: string): Promise<void> {
    this.state = {
      ...this.state,
      pendingConfirmation: null,
      flowFeedback: {
        tone: 'neutral',
        message: 'A guardar esta configuracao global do produto.',
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
      const message = `Nao foi possivel atualizar esta configuracao global. ${readErrorMessage(error)}`;
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

  private renderAssistantChatHistory(
    emptyTitle = 'Sem conversa ainda',
    emptyDescription = 'Escreve uma pergunta e recebe a resposta aqui, sem tocar no WhatsApp.',
    extraClass = '',
  ): string {
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
            <strong>${escapeHtml(emptyTitle)}</strong>
            <p>${escapeHtml(emptyDescription)}</p>
          </div>
        `;

    return `<div class="rail-chat-history${extraClass ? ` ${escapeHtml(extraClass)}` : ''}" aria-live="polite">${historyHtml}</div>`;
  }

  private renderAssistantRail(currentRoute: ResolvedAppRoute): string {
    const groups = this.state.assistantRailChat.availableGroups;
    const selectedGroup =
      groups.find((group) => group.groupJid === this.state.assistantRailChat.selectedGroupJid) ?? null;
    const contextLabel =
      this.state.assistantRailChat.contextMode === 'group'
        ? selectedGroup?.preferredSubject ?? 'Escolhe um grupo'
        : 'Global';

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

          ${this.renderAssistantChatHistory()}

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
    const chatSurfaceLabel =
      this.currentRouter().resolveRoute(this.state.route).canonicalRoute === '/assistant'
        ? 'chat direto'
        : 'chat de apoio';

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
          message: `${capitalizeFirst(chatSurfaceLabel)} limpo. Podes recomecar em global ou com contexto de grupo.`,
        },
      };
      this.recordUxEvent('neutral', `${capitalizeFirst(chatSurfaceLabel)} limpo.`);
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
          message: `Escreve primeiro a pergunta que queres fazer neste ${chatSurfaceLabel}.`,
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
              ? `Resposta pronta no ${chatSurfaceLabel} global.`
              : `Resposta pronta no ${chatSurfaceLabel} com contexto de ${contextLabel}.`,
        },
      };
      this.appendAssistantRailMessage('assistant', result.text, contextLabel);
      this.recordUxEvent('positive', `${capitalizeFirst(chatSurfaceLabel)} respondeu em ${contextLabel}.`);
      this.render();
      return;
    } catch (error) {
      const message = `Nao foi possivel obter resposta neste ${chatSurfaceLabel}. ${readErrorMessage(error)}`;
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

  private buildSettingsConfirmation(
    action: string,
    dataset: ActionDataset,
    snapshot: SettingsSnapshot,
    people: readonly WorkspacePersonView[],
  ): PendingConfirmation | null {
    if (action === 'toggle-command-setting') {
      const setting = dataset.commandSetting;

      if (setting === 'assistantEnabled' && snapshot.adminSettings.commands.assistantEnabled) {
        return {
          domain: 'settings',
          key: 'toggle-command-setting:assistantEnabled',
          action,
          dataset,
          title: 'Desligar o assistente global?',
          description: 'Isto corta o assistente em toda a app, mesmo que os grupos continuem autorizados.',
          confirmLabel: 'Desligar assistente',
          tone: 'danger',
        };
      }

      if (setting === 'allowPrivateAssistant' && snapshot.adminSettings.commands.allowPrivateAssistant) {
        return {
          domain: 'settings',
          key: 'toggle-command-setting:allowPrivateAssistant',
          action,
          dataset,
          title: 'Bloquear todos os privados?',
          description: 'Os contactos privados deixam de poder usar o assistente ate voltares a abrir esta permissao.',
          confirmLabel: 'Bloquear privados',
          tone: 'warning',
        };
      }
    }

    if (action === 'toggle-llm-setting' && dataset.llmSetting === 'enabled' && snapshot.adminSettings.llm.enabled) {
      return {
        domain: 'settings',
        key: 'toggle-llm-setting:enabled',
        action,
        dataset,
        title: 'Desligar a LLM live?',
        description: 'O runtime passa a fallback deterministico ou modo desligado, conforme a configuracao atual.',
        confirmLabel: 'Desligar LLM',
        tone: 'warning',
      };
    }

    if (action === 'toggle-app-owner') {
      const person = people.find((candidate) => candidate.personId === dataset.personId);

      if (person?.globalRoles.includes('app_owner')) {
        return {
          domain: 'settings',
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
          domain: 'settings',
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

    return null;
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

  private captureFocusedFieldSnapshot(): FocusedFieldSnapshot | null {
    if (!this.root) {
      return null;
    }

    const activeElement = document.activeElement;
    if (
      !(activeElement instanceof HTMLInputElement) &&
      !(activeElement instanceof HTMLTextAreaElement) &&
      !(activeElement instanceof HTMLSelectElement)
    ) {
      return null;
    }

    if (!this.root.contains(activeElement)) {
      return null;
    }

    const fieldKey = activeElement.dataset.fieldKey;
    if (!fieldKey) {
      return null;
    }

    const matchingFields = this.findFieldsByKey(fieldKey);
    const fieldIndex = matchingFields.indexOf(activeElement);
    if (fieldIndex < 0) {
      return null;
    }

    const selectionCapable =
      activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;

    return {
      fieldKey,
      fieldIndex,
      selectionStart: selectionCapable ? activeElement.selectionStart : null,
      selectionEnd: selectionCapable ? activeElement.selectionEnd : null,
      selectionDirection: selectionCapable ? activeElement.selectionDirection : null,
      scrollTop: activeElement.scrollTop,
      scrollLeft: activeElement.scrollLeft,
    };
  }

  private restoreFocusedFieldSnapshot(snapshot: FocusedFieldSnapshot | null): void {
    if (!snapshot) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (!this.root) {
        return;
      }

      const matchingFields = this.findFieldsByKey(snapshot.fieldKey);
      const field = matchingFields.at(snapshot.fieldIndex) ?? matchingFields[0];
      if (!field || field.disabled) {
        return;
      }

      try {
        field.focus({ preventScroll: true });
      } catch {
        field.focus();
      }

      field.scrollTop = snapshot.scrollTop;
      field.scrollLeft = snapshot.scrollLeft;

      if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLTextAreaElement)) {
        return;
      }

      if (snapshot.selectionStart === null || snapshot.selectionEnd === null) {
        return;
      }

      const selectionStart = Math.min(snapshot.selectionStart, field.value.length);
      const selectionEnd = Math.min(snapshot.selectionEnd, field.value.length);

      try {
        field.setSelectionRange(selectionStart, selectionEnd, snapshot.selectionDirection ?? 'none');
      } catch {
        field.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  }

  private findFieldsByKey(fieldKey: string): Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
    if (!this.root) {
      return [];
    }

    return Array.from(
      this.root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-field-key]'),
    ).filter((field) => field.dataset.fieldKey === fieldKey);
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
  readonly intent: 'direct_group_chat' | 'sidebar_group_chat';
  readonly prompt: string;
  readonly preview: GroupContextPreviewSnapshot;
  readonly baseContextSummary: readonly string[];
}): LlmChatInput {
  const { intent, prompt, preview, baseContextSummary } = input;
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
    intent,
    contextSummary,
    domainFacts,
    memoryScope: {
      scope: 'group',
      groupJid: preview.groupJid,
      groupLabel,
      instructionsSource: preview.groupInstructionsSource,
      instructionsApplied: Boolean(preview.groupInstructions),
      knowledgeSnippetCount: preview.groupKnowledgeSnippets.length,
      knowledgeDocuments: preview.groupKnowledgeSnippets.slice(0, 6).map((snippet) => ({
        documentId: snippet.documentId,
        title: snippet.title,
        filePath: snippet.filePath,
        score: snippet.score,
        matchedTerms: snippet.matchedTerms,
      })),
    },
  };
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function capitalizeFirst(value: string): string {
  return value.length > 0 ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
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
  const fallbackGroup = groups.find((group) => canGroupUseManualScheduling(group)) ?? groups[0] ?? null;
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

  return groups.find((group) => canGroupUseLlmScheduling(group))?.groupJid ?? groups[0]?.groupJid ?? '';
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
  const segments: string[] = [];

  if (entry.permissionInsight?.summary) {
    segments.push(entry.permissionInsight.summary);
  }

  if (!entry.memoryUsage || entry.memoryUsage.scope !== 'group') {
    segments.push('Sem memoria de grupo');
    return segments.join(' | ');
  }

  const documentLabel =
    entry.memoryUsage.knowledgeDocuments.length > 0
      ? `docs ${entry.memoryUsage.knowledgeDocuments
          .slice(0, 2)
          .map((document) => document.title)
          .join(', ')}`
      : 'sem docs';

  segments.push(
    `grupo ${entry.memoryUsage.groupLabel ?? entry.memoryUsage.groupJid ?? 'desconhecido'}`,
    `instr ${entry.memoryUsage.instructionsSource ?? 'missing'}`,
    `${entry.memoryUsage.knowledgeSnippetCount} snippet(s)`,
    documentLabel,
  );
  return segments.join(' | ');
}

function describeWeekNotificationMix(input: {
  readonly pending: number;
  readonly waitingConfirmation: number;
  readonly sent: number;
}): string {
  const segments: string[] = [];

  if (input.pending > 0) {
    segments.push(`${input.pending} por enviar`);
  }

  if (input.waitingConfirmation > 0) {
    segments.push(`${input.waitingConfirmation} a confirmar`);
  }

  if (input.sent > 0) {
    segments.push(`${input.sent} ja fechados`);
  }

  return segments.length > 0 ? segments.join(', ') : 'Sem lembretes abertos nesta leitura.';
}

function describeWeekDaySummary(day: WeekCalendarDayView): string {
  if (day.events.length === 0) {
    return 'Sem eventos planeados neste dia.';
  }

  return `${day.events.length} evento(s). ${describeWeekNotificationMix({
    pending: day.notifications.pendingNotifications,
    waitingConfirmation: day.notifications.waitingConfirmationNotifications,
    sent: day.notifications.sentNotifications,
  })}`;
}

function formatWeekEventMoment(
  event: Pick<WeekPlannerSnapshot['events'][number], 'localDate' | 'dayLabel' | 'startTime'>,
): string {
  const dateLabel = event.localDate ? formatWeekDayDateLabel(event.localDate) : readableWeekDayLabel(event.dayLabel);
  return `${dateLabel} as ${event.startTime}`;
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
  group: WeekPlannerSnapshot['groups'][number] | null,
): string {
  const status = describeWeekCalendarEventStatus(event);
  const canEdit = group ? canGroupUseManualScheduling(group) : true;
  const ruleCountLabel =
    event.notificationRuleLabels.length === 1
      ? '1 lembrete ativo'
      : `${event.notificationRuleLabels.length} lembretes ativos`;

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
      <p class="week-event-card__notes">${escapeHtml(event.notes || 'Sem nota interna para ja.')}</p>
      <p class="week-event-card__notes">${escapeHtml(
        event.nextReminderAt
          ? `Proximo lembrete: ${event.nextReminderLabel ?? 'sem etiqueta'} em ${formatShortDateTime(event.nextReminderAt)}.`
          : 'Ainda nao existe um proximo disparo planeado para este evento.',
      )}</p>
      <div class="ui-card__chips">
        ${renderUiBadge({ label: ruleCountLabel, tone: 'positive', style: 'chip' })}
        ${renderUiBadge({
          label: `Gerados ${event.reminderLifecycle.generated}`,
          tone: event.reminderLifecycle.generated > 0 ? 'neutral' : 'positive',
          style: 'chip',
        })}
        ${renderUiBadge({
          label: `Preparados ${event.reminderLifecycle.prepared}`,
          tone: event.reminderLifecycle.prepared > 0 ? 'warning' : 'neutral',
          style: 'chip',
        })}
        ${renderUiBadge({
          label: `Enviados ${event.reminderLifecycle.sent}`,
          tone: event.reminderLifecycle.sent > 0 ? 'positive' : 'neutral',
          style: 'chip',
        })}
        ${renderUiBadge({
          label: `A confirmar ${event.notifications.waitingConfirmation}`,
          tone: event.notifications.waitingConfirmation > 0 ? 'warning' : 'neutral',
          style: 'chip',
        })}
        ${renderUiBadge({
          label: `Fechados ${event.notifications.sent}`,
          tone: event.notifications.sent > 0 ? 'positive' : 'neutral',
          style: 'chip',
        })}
        ${
          group
            ? renderUiBadge({
                label: canEdit ? 'Agenda local ativa' : 'Grupo fora da agenda local',
                tone: canEdit ? 'positive' : 'warning',
                style: 'chip',
              })
            : ''
        }
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
          label: 'Abrir no editor',
          variant: 'secondary',
          disabled: !canEdit,
          dataAttributes: {
            'flow-action': 'schedule-load-event',
            'flow-value': event.eventId,
          },
        })}
        ${renderUiActionButton({
          label: 'Retirar da agenda',
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
  if (event.reminderLifecycle.prepared > 0) {
    return {
      label: event.reminderLifecycle.prepared === 1 ? '1 lembrete preparado' : `${event.reminderLifecycle.prepared} preparados`,
      tone: 'warning',
    };
  }

  if (event.notifications.waitingConfirmation > 0) {
    return {
      label: `${event.notifications.waitingConfirmation} a confirmar`,
      tone: 'warning',
    };
  }

  if (event.notifications.pending > 0 || event.reminderLifecycle.generated > 0) {
    return {
      label:
        event.reminderLifecycle.generated === 1
          ? '1 lembrete por preparar'
          : `${event.reminderLifecycle.generated} por preparar`,
      tone: 'neutral',
    };
  }

  if (event.notifications.sent > 0) {
    return {
      label: event.notifications.sent === 1 ? '1 lembrete enviado' : `${event.notifications.sent} lembretes enviados`,
      tone: 'positive',
    };
  }

  return {
    label: 'Sem lembretes ativos',
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

function canGroupUseManualScheduling(group: OperationalGroupLike): boolean {
  return group.operationalSettings.mode === 'com_agendamento' && group.operationalSettings.schedulingEnabled;
}

function canGroupUseLlmScheduling(group: OperationalGroupLike): boolean {
  return canGroupUseManualScheduling(group) && group.operationalSettings.allowLlmScheduling;
}

function describeManualSchedulingState(group: OperationalGroupLike): string {
  if (group.operationalSettings.mode === 'distribuicao_apenas') {
    return 'Segue para distribuicao e nao para calendario local.';
  }

  if (!group.operationalSettings.schedulingEnabled) {
    return 'Agendamento local desligado neste grupo.';
  }

  if (!group.operationalSettings.allowLlmScheduling) {
    return 'Calendario manual ativo, mas a LLM nao decide scheduling aqui.';
  }

  return 'Calendario e LLM scheduling ativos neste grupo.';
}

function describeAssistantSchedulingState(group: OperationalGroupLike): string {
  if (group.operationalSettings.mode === 'distribuicao_apenas') {
    return 'Este grupo nao usa agenda local. Aqui serves para distribuir mensagens, nao para mexer no calendario.';
  }

  if (!group.operationalSettings.schedulingEnabled) {
    return 'A agenda deste grupo esta desligada. Liga-a na pagina do grupo antes de pedires alteracoes.';
  }

  if (!group.operationalSettings.allowLlmScheduling) {
    return 'A agenda deste grupo existe, mas as mudancas continuam manuais.';
  }

  return 'Podes pedir preview aqui e so depois confirmar a mudanca.';
}

function describeAssistantSchedulingOption(group: OperationalGroupLike): string {
  if (canGroupUseLlmScheduling(group)) {
    return 'Pode mudar agenda aqui';
  }

  if (group.operationalSettings.mode === 'distribuicao_apenas') {
    return 'So distribuicao';
  }

  if (!group.operationalSettings.schedulingEnabled) {
    return 'Agenda desligada';
  }

  return 'Agenda manual';
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
    return route === '/whatsapp' || route === '/settings' || route === '/today';
  }

  if (topic.startsWith('settings.codex_auth_router')) {
    return route === '/settings' || route === '/codex-router';
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
    reminderPolicy: mapReminderPolicySnapshotToDraft(null),
    selectedDocumentId: null,
    knowledgeDocument: createEmptyGroupKnowledgeDraft(),
  };
}

function mapReminderPolicySnapshotToDraft(policy: GroupReminderPolicySnapshot | null): GroupReminderPolicyDraft {
  if (!policy) {
    return {
      enabled: true,
      reminders: createDefaultReminderDrafts(),
    };
  }

  const reminders = policy.reminders.map((reminder) => mapReminderSnapshotToDraft(reminder));

  return {
    enabled: policy.enabled,
    reminders: reminders.length > 0 || policy.exists ? reminders : createDefaultReminderDrafts(),
  };
}

function mapReminderSnapshotToDraft(reminder: GroupReminderPolicySnapshot['reminders'][number]): GroupReminderDraft {
  const timingMode =
    reminder.kind === 'relative_before_event'
      ? 'relative_before_event'
      : reminder.kind === 'relative_after_event'
        ? 'relative_after_event'
        : (reminder.daysBeforeEvent ?? 0) > 0
          ? 'fixed_previous_day'
          : 'fixed_same_day';

  return {
    reminderId: reminder.reminderId,
    enabled: reminder.enabled,
    label: reminder.label ?? '',
    timingMode,
    offsetMinutes: String(
      timingMode === 'relative_after_event'
        ? reminder.offsetMinutesAfterEvent ?? 30
        : reminder.offsetMinutesBeforeEvent ?? 30,
    ),
    localTime: reminder.localTime ?? '18:00',
    messageTemplate: reminder.messageTemplate ?? defaultMessageTemplateForTimingMode(timingMode),
    llmPromptTemplate: reminder.llmPromptTemplate ?? defaultLlmPromptTemplateForTimingMode(timingMode),
  };
}

function mapReminderPolicyDraftToPayload(draft: GroupReminderPolicyDraft): {
  readonly enabled: boolean;
  readonly reminders: readonly {
    readonly ruleId?: string;
    readonly kind: 'relative_before_event' | 'fixed_local_time' | 'relative_after_event';
    readonly enabled?: boolean;
    readonly label?: string | null;
    readonly daysBeforeEvent?: number | null;
    readonly offsetMinutesBeforeEvent?: number | null;
    readonly offsetMinutesAfterEvent?: number | null;
    readonly localTime?: string | null;
    readonly messageTemplate?: string | null;
    readonly llmPromptTemplate?: string | null;
  }[];
} {
  return {
    enabled: draft.enabled,
    reminders: draft.reminders.map((reminder) => ({
      ruleId: reminder.reminderId.startsWith('draft-') ? undefined : reminder.reminderId,
      kind:
        reminder.timingMode === 'fixed_previous_day' || reminder.timingMode === 'fixed_same_day'
          ? 'fixed_local_time'
          : reminder.timingMode,
      enabled: reminder.enabled,
      label: reminder.label.trim() || null,
      daysBeforeEvent:
        reminder.timingMode === 'fixed_previous_day'
          ? 1
          : reminder.timingMode === 'fixed_same_day'
            ? 0
            : null,
      offsetMinutesBeforeEvent:
        reminder.timingMode === 'relative_before_event'
          ? sanitizeReminderOffset(reminder.offsetMinutes)
          : null,
      offsetMinutesAfterEvent:
        reminder.timingMode === 'relative_after_event'
          ? sanitizeReminderOffset(reminder.offsetMinutes)
          : null,
      localTime:
        reminder.timingMode === 'fixed_previous_day' || reminder.timingMode === 'fixed_same_day'
          ? (reminder.localTime.trim() || '18:00')
          : null,
      messageTemplate: reminder.messageTemplate.trim() || null,
      llmPromptTemplate: reminder.llmPromptTemplate.trim() || null,
    })),
  };
}

function sanitizeReminderOffset(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 30;
}

function createDefaultReminderDrafts(): readonly GroupReminderDraft[] {
  return [
    createReminderDraft({
      reminderId: 'draft-reminder-24h',
      timingMode: 'relative_before_event',
      label: '24h antes',
      offsetMinutes: '1440',
    }),
    createReminderDraft({
      reminderId: 'draft-reminder-30m',
      timingMode: 'relative_before_event',
      label: '30 min antes',
      offsetMinutes: '30',
    }),
  ];
}

function createNextReminderDraft(index: number): GroupReminderDraft {
  const presets: readonly Partial<GroupReminderDraft>[] = [
    {
      reminderId: 'draft-reminder-24h',
      timingMode: 'relative_before_event',
      label: '24h antes',
      offsetMinutes: '1440',
    },
    {
      reminderId: 'draft-reminder-30m',
      timingMode: 'relative_before_event',
      label: '30 min antes',
      offsetMinutes: '30',
    },
    {
      reminderId: 'draft-reminder-prev-day',
      timingMode: 'fixed_previous_day',
      label: 'Dia anterior as 18:00',
      localTime: '18:00',
    },
    {
      reminderId: 'draft-reminder-after',
      timingMode: 'relative_after_event',
      label: '30 min depois',
      offsetMinutes: '30',
    },
  ];

  return createReminderDraft({
    reminderId: `draft-reminder-${index + 1}`,
    ...(presets[index] ?? {
      timingMode: 'relative_before_event',
      label: `Lembrete ${index + 1}`,
      offsetMinutes: '60',
    }),
  });
}

function createReminderDraft(input: Partial<GroupReminderDraft> = {}): GroupReminderDraft {
  const timingMode = input.timingMode ?? 'relative_before_event';

  return {
    reminderId: input.reminderId ?? `draft-reminder-${Math.random().toString(36).slice(2, 8)}`,
    enabled: input.enabled ?? true,
    label: input.label ?? '',
    timingMode,
    offsetMinutes: input.offsetMinutes ?? '30',
    localTime: input.localTime ?? '18:00',
    messageTemplate: input.messageTemplate ?? defaultMessageTemplateForTimingMode(timingMode),
    llmPromptTemplate: input.llmPromptTemplate ?? defaultLlmPromptTemplateForTimingMode(timingMode),
  };
}

function defaultMessageTemplateForTimingMode(timingMode: ReminderTimingMode): string {
  switch (timingMode) {
    case 'fixed_previous_day':
      return 'Amanha temos {{event_title}} as {{event_time}}.';
    case 'fixed_same_day':
      return 'Hoje temos {{event_title}} as {{event_time}}.';
    case 'relative_after_event':
      return 'Ja passou {{minutes_since_event}} min desde {{event_title}}.';
    case 'relative_before_event':
    default:
      return 'Daqui a {{minutes_until_event}} min temos {{event_title}}.';
  }
}

function defaultLlmPromptTemplateForTimingMode(timingMode: ReminderTimingMode): string {
  switch (timingMode) {
    case 'fixed_previous_day':
      return 'Escreve um lembrete curto em portugues europeu para WhatsApp. Contexto: amanha o grupo {{group_label}} tem {{event_title}} as {{event_time}}.';
    case 'fixed_same_day':
      return 'Escreve um lembrete curto em portugues europeu para WhatsApp. Contexto: hoje o grupo {{group_label}} tem {{event_title}} as {{event_time}}.';
    case 'relative_after_event':
      return 'Escreve um follow-up curto em portugues europeu para WhatsApp. Contexto: ja passaram {{minutes_since_event}} minutos desde {{event_title}} em {{event_datetime}}.';
    case 'relative_before_event':
    default:
      return 'Escreve um lembrete curto em portugues europeu para WhatsApp. Contexto: faltam {{minutes_until_event}} minutos para {{event_title}} em {{event_datetime}} no grupo {{group_label}}.';
  }
}

function readableReminderSummary(reminder: GroupReminderDraft): string {
  if (reminder.label.trim()) {
    return reminder.label.trim();
  }

  if (reminder.timingMode === 'fixed_previous_day') {
    return `Dia anterior as ${reminder.localTime || '18:00'}`;
  }

  if (reminder.timingMode === 'fixed_same_day') {
    return `No proprio dia as ${reminder.localTime || '08:00'}`;
  }

  const minutes = sanitizeReminderOffset(reminder.offsetMinutes);

  if (minutes % 1_440 === 0) {
    return `${minutes / 1_440} dia(s) ${reminder.timingMode === 'relative_after_event' ? 'depois' : 'antes'}`;
  }

  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60}h ${reminder.timingMode === 'relative_after_event' ? 'depois' : 'antes'}`;
  }

  return `${minutes} min ${reminder.timingMode === 'relative_after_event' ? 'depois' : 'antes'}`;
}

function buildReminderPreviewContext(
  group: Group | null,
  event: GroupManagementPageData['reminderPreviewEvent'],
): {
  readonly groupLabel: string;
  readonly eventTitle: string;
  readonly eventAt: string;
  readonly eventDateLabel: string;
  readonly eventTimeLabel: string;
  readonly reminderLabel: string;
} {
  const eventAt = event?.eventAt ?? '2026-04-21T18:00:00.000Z';

  return {
    groupLabel: group?.preferredSubject ?? 'Grupo exemplo',
    eventTitle: event?.title ?? 'Aula exemplo',
    eventAt,
    eventDateLabel: event ? formatWeekDayDateLabel(event.localDate) : '21/04/2026',
    eventTimeLabel: event?.startTime ?? '18:00',
    reminderLabel: event ? `Proximo evento: ${event.title}` : 'Preview com evento exemplo',
  };
}

function buildReminderPreview(
  reminder: GroupReminderDraft,
  context: ReturnType<typeof buildReminderPreviewContext>,
): {
  readonly sendLabel: string;
  readonly messagePreview: string;
  readonly promptPreview: string;
} {
  const eventAt = new Date(context.eventAt);
  const sendAt = resolveReminderPreviewSendAt(reminder, eventAt);
  const variables = buildReminderPreviewVariables(reminder, context, eventAt, sendAt);

  return {
    sendLabel: `${readableReminderSummary(reminder)} · ${formatShortDateTime(sendAt.toISOString())}`,
    messagePreview: renderPreviewTemplate(reminder.messageTemplate, variables),
    promptPreview: renderPreviewTemplate(reminder.llmPromptTemplate, variables),
  };
}

function resolveReminderPreviewSendAt(reminder: GroupReminderDraft, eventAt: Date): Date {
  const sendAt = new Date(eventAt);

  if (reminder.timingMode === 'relative_before_event') {
    sendAt.setTime(eventAt.getTime() - (sanitizeReminderOffset(reminder.offsetMinutes) * 60_000));
    return sendAt;
  }

  if (reminder.timingMode === 'relative_after_event') {
    sendAt.setTime(eventAt.getTime() + (sanitizeReminderOffset(reminder.offsetMinutes) * 60_000));
    return sendAt;
  }

  const [hours, minutes] = (reminder.localTime || '18:00').split(':').map((value) => Number.parseInt(value, 10));
  sendAt.setHours(Number.isInteger(hours) ? hours : 18, Number.isInteger(minutes) ? minutes : 0, 0, 0);

  if (reminder.timingMode === 'fixed_previous_day') {
    sendAt.setDate(sendAt.getDate() - 1);
  }

  return sendAt;
}

function buildReminderPreviewVariables(
  reminder: GroupReminderDraft,
  context: ReturnType<typeof buildReminderPreviewContext>,
  eventAt: Date,
  sendAt: Date,
): Record<string, string | number> {
  const diffMinutes = Math.round((eventAt.getTime() - sendAt.getTime()) / 60_000);
  const minutesUntilEvent = Math.max(diffMinutes, 0);
  const minutesSinceEvent = Math.max(-diffMinutes, 0);

  return {
    group_label: context.groupLabel,
    event_title: context.eventTitle,
    event_date: context.eventDateLabel,
    event_time: context.eventTimeLabel,
    event_datetime: `${context.eventDateLabel}, ${context.eventTimeLabel}`,
    send_datetime: formatShortDateTime(sendAt.toISOString()),
    reminder_label: readableReminderSummary(reminder),
    minutes_until_event: minutesUntilEvent,
    hours_until_event: formatReminderHours(minutesUntilEvent),
    minutes_since_event: minutesSinceEvent,
    hours_since_event: formatReminderHours(minutesSinceEvent),
  };
}

function renderPreviewTemplate(template: string, variables: Record<string, string | number>): string {
  const resolved = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gu, (_match, key) => String(variables[key] ?? ''));
  return resolved.trim() || 'Sem texto ainda.';
}

function formatReminderHours(minutes: number): string {
  if (minutes <= 0) {
    return '0';
  }

  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
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
  if (page && page.data && page.route === '/groups') {
    return (page as UiPage<GroupManagementPageData>).data.groups.map((group) => ({
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
    }));
  }

  if (page && page.data && page.route === '/assistant') {
    return (page as UiPage<AssistantPageData>).data.groups.map((group) => ({
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
    }));
  }

  if (page && page.data && page.route === '/media') {
    return (page as UiPage<MediaLibraryPageData>).data.groups.map((group) => ({
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
    }));
  }

  if (page && page.data && page.route === '/week') {
    return (page as UiPage<WeekPlannerSnapshot>).data.groups.map((group) => ({
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
    }));
  }

  if (page && page.data && page.route === '/whatsapp') {
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

function renderGroupEffectivePermissionList(group: GroupPermissionSource): string {
  return `
    <div class="group-role-permission-list">
      ${buildGroupRolePermissionRows(group)
        .map(
          (row) => `
            <p><strong>${escapeHtml(row.roleLabel)}</strong>: ${escapeHtml(row.botSummary)} ${escapeHtml(row.schedulingSummary)}</p>
          `,
        )
        .join('')}
    </div>
  `;
}

function buildGroupRolePermissionRows(
  group: GroupPermissionSource,
): readonly {
  readonly roleLabel: string;
  readonly botSummary: string;
  readonly schedulingSummary: string;
}[] {
  return [
    {
      roleLabel: 'App owner',
      botSummary: describeGroupRoleBotAccess('app_owner', group),
      schedulingSummary: describeGroupRoleSchedulingAccess('app_owner', group),
    },
    {
      roleLabel: 'Owner do grupo',
      botSummary: describeGroupRoleBotAccess('group_owner', group),
      schedulingSummary: describeGroupRoleSchedulingAccess('group_owner', group),
    },
    {
      roleLabel: 'Membro',
      botSummary: describeGroupRoleBotAccess('member', group),
      schedulingSummary: describeGroupRoleSchedulingAccess('member', group),
    },
  ];
}

function describeGroupRoleBotAccess(
  role: 'app_owner' | 'group_owner' | 'member',
  group: GroupPermissionSource,
): string {
  if (role === 'app_owner') {
    return group.assistantAuthorized
      ? 'Pode sempre chamar o bot neste grupo.'
      : 'Pode chamar o bot mesmo com o grupo bloqueado para membros.';
  }

  if (!group.assistantAuthorized) {
    return 'Nao pode usar o bot enquanto este grupo estiver bloqueado.';
  }

  if (role === 'group_owner') {
    return 'Pode chamar o bot por tag ou reply.';
  }

  return group.operationalSettings.memberTagPolicy === 'members_can_tag'
    ? 'Pode chamar o bot por tag ou reply.'
    : 'Nao pode dirigir o bot; este grupo reserva o bot ao owner.';
}

function describeGroupRoleSchedulingAccess(
  role: 'app_owner' | 'group_owner' | 'member',
  group: GroupPermissionSource,
): string {
  if (role !== 'app_owner' && !group.assistantAuthorized) {
    return 'Sem acesso operacional enquanto o assistente estiver bloqueado.';
  }

  if (role === 'member' && group.operationalSettings.memberTagPolicy === 'owner_only') {
    return 'Tambem fica sem pedir agendamentos porque o bot esta reservado ao owner.';
  }

  if (group.operationalSettings.mode === 'distribuicao_apenas') {
    return 'Nao usa agenda local; tudo aqui segue para distribuicao.';
  }

  if (!group.operationalSettings.schedulingEnabled) {
    return 'A agenda local esta desligada neste grupo.';
  }

  const accessMode =
    role === 'app_owner'
      ? group.calendarAccessPolicy.appOwner
      : role === 'group_owner'
        ? group.calendarAccessPolicy.groupOwner
        : group.calendarAccessPolicy.group;

  if (accessMode === 'read') {
    return 'Pode consultar o calendario, mas nao pedir alteracoes.';
  }

  if (!group.operationalSettings.allowLlmScheduling) {
    return 'Pode mexer no calendario, mas a LLM nao agenda aqui.';
  }

  return 'Pode pedir scheduling assistido pela LLM.';
}

function buildSettingsPeopleViews(
  people: readonly Person[],
  settings: SettingsSnapshot,
): readonly WorkspacePersonView[] {
  const knownPrivateJids = dedupeStringList(
    people.flatMap((person) =>
      person.identifiers
        .filter((identifier) => identifier.kind === 'whatsapp_jid')
        .map((identifier) => identifier.value),
    ),
  );
  const authorizedPrivateJids = resolveAuthorizedPrivateJidsForCommands(
    settings.adminSettings.commands,
    knownPrivateJids,
  );

  return people.map((person) => {
    const whatsappJids = person.identifiers
      .filter((identifier) => identifier.kind === 'whatsapp_jid')
      .map((identifier) => identifier.value);

    return {
      personId: person.personId,
      displayName: person.displayName,
      whatsappJids,
      globalRoles: dedupePersonRoles(person.globalRoles),
      privateAssistantAuthorized: whatsappJids.some((jid) => authorizedPrivateJids.includes(jid)),
      ownedGroupJids: [],
      knownToBot: whatsappJids.length > 0,
    } satisfies WorkspacePersonView;
  });
}

function resolveAuthorizedPrivateJidsForCommands(
  commands: SettingsSnapshot['adminSettings']['commands'],
  knownPrivateJids: readonly string[],
): string[] {
  if (!commands.assistantEnabled || !commands.allowPrivateAssistant) {
    return [];
  }

  if (commands.authorizedPrivateJids.length === 0) {
    return dedupeStringList(knownPrivateJids);
  }

  return dedupeStringList(commands.authorizedPrivateJids);
}

function resolveAuthorizedPrivateJids(snapshot: WhatsAppWorkspaceSnapshot): string[] {
  return resolveAuthorizedPrivateJidsForCommands(
    snapshot.settings.commands,
    snapshot.conversations.flatMap((conversation) => conversation.whatsappJids),
  );
}

function isProductCommandSettingKey(value: string): value is ProductCommandSettingKey {
  return PRODUCT_COMMAND_SETTING_KEYS.includes(value as ProductCommandSettingKey);
}

function isProductLlmSettingKey(value: string): value is ProductLlmSettingKey {
  return PRODUCT_LLM_SETTING_KEYS.includes(value as ProductLlmSettingKey);
}

function isProductPowerMode(value: string): value is ProductPowerMode {
  return PRODUCT_POWER_MODES.includes(value as ProductPowerMode);
}

function readCommandSettingLabel(key: ProductCommandSettingKey): string {
  switch (key) {
    case 'assistantEnabled':
      return 'Assistente global';
    case 'schedulingEnabled':
      return 'Scheduling global';
    case 'autoReplyEnabled':
      return 'Auto-reply';
    case 'directRepliesEnabled':
      return 'Respostas diretas';
    case 'allowPrivateAssistant':
      return 'Assistente privado';
    case 'ownerTerminalEnabled':
      return 'Terminal do owner';
  }
}

function readCommandSettingDescription(key: ProductCommandSettingKey, enabled: boolean): string {
  switch (key) {
    case 'assistantEnabled':
      return enabled
        ? 'O assistente pode operar nos grupos autorizados.'
        : 'O assistente fica bloqueado em toda a app.';
    case 'schedulingEnabled':
      return enabled
        ? 'Calendario e jobs continuam disponiveis quando o grupo o permite.'
        : 'Bloqueia scheduling em toda a app.';
    case 'autoReplyEnabled':
      return enabled
        ? 'O bot pode responder de forma automatica quando a policy o permite.'
        : 'As respostas automaticas ficam paradas.';
    case 'directRepliesEnabled':
      return enabled
        ? 'Permite replies diretas quando o runtime as decide.'
        : 'As replies diretas ficam bloqueadas.';
    case 'allowPrivateAssistant':
      return enabled
        ? 'Os privados autorizados podem falar com o assistente.'
        : 'Nenhum privado pode usar o assistente.';
    case 'ownerTerminalEnabled':
      return enabled
        ? 'Owners continuam com capacidades avancadas no produto.'
        : 'O terminal do owner fica desligado.';
  }
}

function readCommandSettingMutationMessage(key: ProductCommandSettingKey, enabled: boolean): string {
  switch (key) {
    case 'assistantEnabled':
      return enabled ? 'O assistente global ficou ligado.' : 'O assistente global ficou desligado.';
    case 'schedulingEnabled':
      return enabled ? 'O scheduling global ficou ligado.' : 'O scheduling global ficou desligado.';
    case 'autoReplyEnabled':
      return enabled ? 'O auto-reply ficou ligado.' : 'O auto-reply ficou desligado.';
    case 'directRepliesEnabled':
      return enabled ? 'As respostas diretas ficaram ligadas.' : 'As respostas diretas ficaram desligadas.';
    case 'allowPrivateAssistant':
      return enabled ? 'O assistente privado ficou ligado.' : 'O assistente privado ficou desligado.';
    case 'ownerTerminalEnabled':
      return enabled ? 'O terminal do owner ficou ligado.' : 'O terminal do owner ficou desligado.';
  }
}

function readLlmSettingLabel(key: ProductLlmSettingKey): string {
  switch (key) {
    case 'enabled':
      return 'LLM live';
    case 'streamingEnabled':
      return 'Streaming';
  }
}

function readLlmSettingDescription(key: ProductLlmSettingKey, enabled: boolean): string {
  switch (key) {
    case 'enabled':
      return enabled
        ? 'O provider configurado continua ativo quando a auth o permitir.'
        : 'A LLM live fica desligada e o runtime cai para fallback.';
    case 'streamingEnabled':
      return enabled
        ? 'As respostas podem chegar em streaming quando o provider o suporta.'
        : 'As respostas passam a sair fechadas no fim.';
  }
}

function readLlmSettingMutationMessage(key: ProductLlmSettingKey, enabled: boolean): string {
  switch (key) {
    case 'enabled':
      return enabled ? 'A LLM live ficou ligada.' : 'A LLM live ficou desligada.';
    case 'streamingEnabled':
      return enabled ? 'O streaming da LLM ficou ligado.' : 'O streaming da LLM ficou desligado.';
  }
}

function readPowerModeLabel(mode: ProductPowerMode): string {
  switch (mode) {
    case 'allow_sleep':
      return 'Dormir permitido';
    case 'on_demand':
      return 'Inibir por procura';
    case 'always_inhibit':
      return 'Inibir sempre';
  }
}

function readCodexAuthLabel(snapshot: SettingsSnapshot): string {
  const codexProvider = snapshot.llmRuntime.providerReadiness.find((provider) => provider.providerId === 'codex-oauth');

  if (codexProvider?.ready) {
    const accountCount = snapshot.authRouterStatus?.accountCount ?? 0;
    return accountCount > 0 ? `pronta (${readCodexTokenCountLabel(accountCount)} prontos)` : 'pronta';
  }

  return codexProvider?.reason ?? 'indisponivel';
}

function readCodexTokenCountLabel(count: number): string {
  return `${count} token${count === 1 ? '' : 's'}`;
}

function readCodexRouterEnabledLabel(enabled: boolean): string {
  return enabled ? 'Ligado' : 'Desligado';
}

function readCodexTokenKindLabel(
  kind: NonNullable<SettingsSnapshot['authRouterStatus']>['accounts'][number]['kind'],
): string {
  return kind === 'canonical_live' ? 'Principal' : 'Reserva';
}

function describeCodexTokenRole(account: NonNullable<SettingsSnapshot['authRouterStatus']>['accounts'][number]): string {
  return account.kind === 'canonical_live'
    ? 'Token canonico usado pelo Codex.'
    : 'Token de reserva conhecido pelo router.';
}

function readCodexTokenAvailability(
  account: NonNullable<SettingsSnapshot['authRouterStatus']>['accounts'][number],
  activeAccountId: string | null,
): {
  readonly label: string;
  readonly tone: UiTone;
  readonly summary: string;
} {
  if (account.accountId === activeAccountId) {
    return {
      label: 'Em uso',
      tone: 'positive',
      summary: 'Este e o token que o Codex esta a usar agora.',
    };
  }

  if (!account.exists) {
    return {
      label: 'Em falta',
      tone: 'warning',
      summary: 'O ficheiro deste token nao esta disponivel neste runtime.',
    };
  }

  if (account.usage.cooldownUntil && Date.parse(account.usage.cooldownUntil) > Date.now()) {
    return {
      label: 'A rever',
      tone: 'warning',
      summary: `Este token esta em pausa ate ${formatShortDateTime(account.usage.cooldownUntil)}.`,
    };
  }

  return {
    label: 'Pronto',
    tone: 'neutral',
    summary: 'Pode entrar em uso quando precisares.',
  };
}

function readCodexQuotaSummary(account: NonNullable<SettingsSnapshot['authRouterStatus']>['accounts'][number]): string {
  const quota = account.quota;

  if (!quota) {
    return 'Ainda sem leitura de limites.';
  }

  if (quota.fetchError) {
    return 'Nao consegui ler os limites agora.';
  }

  if (quota.credits.unlimited) {
    return 'Uso livre sem limite visivel.';
  }

  const freePercent = readCodexQuotaFreePercent(account);
  const usedPercent = quota.primaryWindow?.usedPercent ?? quota.secondaryWindow?.usedPercent ?? null;
  const resetAt = readCodexQuotaResetAt(account);
  const pieces = [
    freePercent === null ? null : `${freePercent}% livre`,
    usedPercent === null ? null : `${usedPercent}% usado`,
    quota.planType ? `plano ${quota.planType}` : null,
    resetAt ? `renova ${formatShortDateTime(resetAt)}` : null,
  ].filter((piece): piece is string => piece !== null);

  if (quota.limitReached) {
    return pieces.length > 0 ? `Limite atingido · ${pieces.join(' · ')}` : 'Limite atingido.';
  }

  return pieces.length > 0 ? pieces.join(' · ') : 'Limites lidos, sem percentagem detalhada.';
}

function renderCodexQuotaMeter(account: NonNullable<SettingsSnapshot['authRouterStatus']>['accounts'][number]): string {
  const quota = account.quota;
  const freePercent = readCodexQuotaFreePercent(account);
  const checkedLabel = quota?.checkedAt ? `Lido ${formatShortDateTime(quota.checkedAt)}` : 'Ainda nao lido';
  const meterTone = quota?.limitReached ? 'warning' : quota?.fetchError ? 'neutral' : 'positive';

  if (freePercent === null) {
    return `
      <div class="codex-router-quota codex-router-quota--${meterTone}">
        <div class="codex-router-quota__header">
          <strong>Uso livre</strong>
          <span>${escapeHtml(checkedLabel)}</span>
        </div>
        <div class="codex-router-quota__empty">${escapeHtml(quota?.fetchError ?? 'Sem percentagem disponivel ainda.')}</div>
      </div>
    `;
  }

  return `
    <div class="codex-router-quota codex-router-quota--${meterTone}">
      <div class="codex-router-quota__header">
        <strong>${escapeHtml(`${freePercent}% livre`)}</strong>
        <span>${escapeHtml(checkedLabel)}</span>
      </div>
      <div class="codex-router-quota__meter" aria-label="${escapeHtml(`${freePercent}% livre`)}">
        <span style="width: ${Math.max(0, Math.min(100, freePercent))}%;"></span>
      </div>
    </div>
  `;
}

function readCodexQuotaFreePercent(account: NonNullable<SettingsSnapshot['authRouterStatus']>['accounts'][number]): number | null {
  const quota = account.quota;

  if (!quota || quota.fetchError) {
    return null;
  }

  if (quota.credits.unlimited) {
    return 100;
  }

  const value = quota.primaryWindow?.remainingPercent ?? quota.secondaryWindow?.remainingPercent ?? null;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null;
}

function readCodexQuotaResetAt(account: NonNullable<SettingsSnapshot['authRouterStatus']>['accounts'][number]): string | null {
  const values = [account.quota?.primaryWindow?.resetAt, account.quota?.secondaryWindow?.resetAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value) && value > Date.now())
    .sort((left, right) => left - right);

  return values.length > 0 ? new Date(values[0] as number).toISOString() : null;
}

function createCanonicalDefaultNotificationRules() {
  return [
    {
      kind: 'relative_before_event' as const,
      daysBeforeEvent: 1,
      offsetMinutesBeforeEvent: 0,
      localTime: null,
      enabled: true,
      label: '24h antes',
    },
    {
      kind: 'relative_before_event' as const,
      daysBeforeEvent: 0,
      offsetMinutesBeforeEvent: 30,
      localTime: null,
      enabled: true,
      label: '30 min antes',
    },
  ];
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
