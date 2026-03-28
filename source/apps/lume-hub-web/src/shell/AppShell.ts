import type {
  CalendarAccessMode,
  DashboardSnapshot,
  DistributionSummary,
  FrontendUiEvent,
  Group,
  GroupContextPreviewSnapshot,
  GroupIntelligenceSnapshot,
  Instruction,
  LlmChatInput,
  MediaAssetSnapshot,
  PersonRole,
  SettingsSnapshot,
  WhatsAppWorkspaceSnapshot,
  WatchdogIssue,
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
  AppRouteDefinition,
  AppRouter,
  GroupManagementPageData,
  MediaLibraryPageData,
  WhatsAppManagementPageData,
} from '../app/AppRouter.js';
import type { WebAppBootstrap } from '../app/WebAppBootstrap.js';

type PreviewState = 'none' | 'loading' | 'empty' | 'offline' | 'error';
type ScreenState = 'loading' | 'ready' | 'empty' | 'offline' | 'error';
type ActionDataset = Readonly<Record<string, string | undefined>>;

const ADVANCED_DETAILS_STORAGE_KEY = 'lumehub.web.advanced_details';
const UX_TELEMETRY_STORAGE_KEY = 'lumehub.web.ux_telemetry';

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

          if (shouldAutoRefreshRoute(this.state.route, event.topic) && this.state.previewState === 'none') {
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

  private render(options: { readonly preserveScroll?: boolean } = {}): void {
    if (!this.root) {
      return;
    }

    const scrollSnapshot = options.preserveScroll === false ? null : this.captureScrollSnapshot();

    const bootstrap = this.getBootstrap(this.state.mode);
    const router = bootstrap.router;
    const currentRoute = router.resolveRoute(this.state.route);
    const navigation = router.navigation();

    document.title = `LumeHub | ${currentRoute.label}`;
    this.root.innerHTML = `
      <a class="skip-link" href="#main-content">Saltar para o conteudo principal</a>
      <div class="app-shell">
        <aside class="shell-nav">
          <section class="surface brand-card">
            <div class="brand-mark">
              <span class="brand-orbit" aria-hidden="true"></span>
              <span>LumeHub</span>
            </div>
          </section>
          <nav class="surface nav-card" aria-label="Navegacao principal">
            ${navigation
              .map(
                (item) => `
                  <a
                    href="${escapeHtml(item.route)}"
                    data-route="${escapeHtml(item.route)}"
                    class="nav-link ${item.route === currentRoute.route ? 'is-active' : ''}"
                    ${item.route === currentRoute.route ? 'aria-current="page"' : ''}
                  >
                    <span>
                      <span class="nav-link-label">${escapeHtml(item.label)}</span>
                    </span>
                  </a>
                `,
              )
              .join('')}
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
              <div class="status-strip">
                ${renderUiBadge({ label: `Modo ${this.state.mode === 'demo' ? 'preview demo' : 'ligacao live'}`, tone: this.state.mode === 'demo' ? 'warning' : 'positive' })}
                ${renderUiBadge({ label: renderScreenStateLabel(this.state.screenState), tone: toneFromScreenState(this.state.screenState) })}
                ${renderUiBadge({ label: `Ultima carga ${formatShortDateTime(this.state.lastLoadedAt)}`, tone: 'neutral' })}
              </div>
              <div class="status-strip">
                ${renderUiBadge({ label: `Data ${formatHeaderDate(new Date())}`, tone: 'neutral' })}
                ${renderUiBadge({ label: 'Timezone Europe/Lisbon', tone: 'neutral' })}
              </div>
            </div>
          </header>

          <main class="page-stack" id="main-content" tabindex="-1">
            ${this.state.pendingConfirmation ? this.renderPendingConfirmationCard() : ''}
            ${this.state.flowFeedback ? `<section class="surface flow-feedback flow-feedback--${this.state.flowFeedback.tone}" role="status" aria-live="polite"><p>${escapeHtml(this.state.flowFeedback.message)}</p></section>` : ''}
            ${this.renderMainContent(currentRoute)}
          </main>
        </div>

        <aside class="shell-rail">
          ${this.renderAssistantRail(currentRoute)}
        </aside>
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

  private renderMainContent(currentRoute: AppRouteDefinition): string {
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
      case '/media':
        return this.renderMediaPage(this.state.page as UiPage<MediaLibraryPageData>);
      case '/groups':
        return this.renderGroupsPage(this.state.page as UiPage<GroupManagementPageData>);
      case '/whatsapp':
        return this.renderWhatsAppPage(this.state.page as UiPage<WhatsAppManagementPageData>);
      case '/settings':
        return this.renderSettingsPage(this.state.page as UiPage<SettingsSnapshot>);
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

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Visao de hoje</p>
          <h2>O que esta bem, o que pede atencao e qual e o proximo passo.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({ label: 'Ver WhatsApp', href: '/whatsapp', dataAttributes: { route: '/whatsapp' } })}
            ${renderUiActionButton({ label: 'Abrir distribuicoes', href: '/distributions', variant: 'secondary', dataAttributes: { route: '/distributions' } })}
            ${renderUiActionButton({ label: 'Abrir configuracao', href: '/settings', variant: 'secondary', dataAttributes: { route: '/settings' } })}
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
            contentHtml: `<p>${escapeHtml(
              snapshot.watchdog.openIssues > 0
                ? 'Comeca por rever as issues abertas do watchdog e confirmar a situacao das entregas.'
                : 'Segue para a area de WhatsApp e valida grupos, owners e estado do auth.',
            )}</p>`,
          })}
        </div>
      </section>

      <section class="card-grid">
        ${renderUiMetricCard({ title: 'WhatsApp pronto', value: readableSessionPhase(snapshot.whatsapp.phase), tone: toneForSessionPhase(snapshot.whatsapp.phase), description: 'Estado live da sessao WhatsApp.' })}
        ${renderUiMetricCard({ title: 'Problemas ativos', value: String(snapshot.watchdog.openIssues), tone: snapshot.watchdog.openIssues > 0 ? 'warning' : 'positive', description: 'Issues que merecem acao agora.' })}
        ${renderUiMetricCard({ title: 'Distribuicoes em curso', value: String(snapshot.distributions.running + snapshot.distributions.queued), tone: snapshot.distributions.running > 0 ? 'warning' : 'neutral', description: 'Campanhas a correr ou em espera.' })}
        ${renderUiMetricCard({ title: 'Grupos com owner', value: `${snapshot.groups.withOwners}/${snapshot.groups.total}`, tone: 'neutral', description: 'Cobertura operacional do diretorio de grupos.' })}
      </section>

      <section class="card-grid">
        ${renderUiRecordCard({
          title: 'Criar agendamento',
          subtitle: 'Fluxo guiado com preview antes de confirmar.',
          badgeLabel: 'Passo a passo',
          badgeTone: 'positive',
          bodyHtml: `
            <p>Escolhe grupo, hora e notas sem ver IDs internos.</p>
            <div class="action-row">
              ${renderUiActionButton({ label: 'Abrir fluxo', href: '/week', dataAttributes: { route: '/week' } })}
            </div>
          `,
        })}
        ${renderUiRecordCard({
          title: 'Distribuir mensagem',
          subtitle: 'Preview de fan-out multi-grupo com confirmacao clara.',
          badgeLabel: 'Com preview',
          badgeTone: 'warning',
          bodyHtml: `
            <p>Prepara a distribuicao e valida os alvos antes de enviar.</p>
            <div class="action-row">
              ${renderUiActionButton({ label: 'Abrir distribuicoes', href: '/distributions', dataAttributes: { route: '/distributions' } })}
            </div>
          `,
        })}
        ${renderUiRecordCard({
          title: 'Ligar ou reparar WhatsApp',
          subtitle: 'Checklist guiada para auth, descoberta e permissoes.',
          badgeLabel: readableSessionPhase(snapshot.whatsapp.phase),
          badgeTone: toneForSessionPhase(snapshot.whatsapp.phase),
          bodyHtml: `
            <p>Segue uma ordem clara para recuperar a ligacao sem mexer as cegas.</p>
            <div class="action-row">
              ${renderUiActionButton({ label: 'Abrir WhatsApp', href: '/whatsapp', dataAttributes: { route: '/whatsapp' } })}
            </div>
          `,
        })}
        ${renderUiRecordCard({
          title: 'Resolver problema watchdog',
          subtitle: 'Inbox operacional com proximo passo recomendado.',
          badgeLabel: snapshot.watchdog.openIssues > 0 ? 'Resolver agora' : 'Sem bloqueios',
          badgeTone: snapshot.watchdog.openIssues > 0 ? 'warning' : 'positive',
          bodyHtml: `
            <p>Ve a issue mais urgente e marca-a como revista quando terminares.</p>
            <div class="action-row">
              ${renderUiActionButton({ label: 'Abrir watchdog', href: '/watchdog', dataAttributes: { route: '/watchdog' } })}
            </div>
          `,
        })}
      </section>

      <section class="content-grid">
        <article class="surface content-card span-7">
          <div class="card-header">
            <h3>Distribuicoes e ritmo de trabalho</h3>
            ${renderUiBadge({ label: `${snapshot.distributions.completed} concluidas`, tone: 'positive' })}
          </div>
          <ul>
            <li>${snapshot.distributions.queued} campanhas em fila e ${snapshot.distributions.running} a correr.</li>
            <li>${snapshot.distributions.partialFailed} com falha parcial e ${snapshot.distributions.failed} totalmente falhadas.</li>
            <li>${snapshot.routing.totalRules} regras ativas de routing, ${snapshot.routing.confirmationRules} com confirmacao.</li>
            <li>${snapshot.routing.totalPlannedTargets} destinos declarados nas regras atuais.</li>
          </ul>
        </article>

        <article class="surface content-card span-5">
          <div class="card-header">
            <h3>Host companion</h3>
            ${renderUiBadge({ label: snapshot.hostCompanion.autostartEnabled ? 'Autostart ativo' : 'Autostart desligado', tone: snapshot.hostCompanion.autostartEnabled ? 'positive' : 'warning' })}
          </div>
          <ul>
            <li>Host: ${escapeHtml(snapshot.hostCompanion.hostId)}</li>
            <li>Mesmo auth do Codex: ${snapshot.hostCompanion.sameAsCodexCanonical ? 'sim' : 'nao'}</li>
            <li>Ultimo heartbeat: ${escapeHtml(formatShortDateTime(snapshot.hostCompanion.lastHeartbeatAt))}</li>
            <li>Ultimo erro: ${escapeHtml(snapshot.hostCompanion.lastError ?? 'sem erros recentes')}</li>
          </ul>
        </article>

        <article class="surface content-card span-6">
          <div class="card-header">
            <h3>Watchdog</h3>
            ${renderUiBadge({ label: snapshot.watchdog.openIssues > 0 ? 'Precisa de atencao' : 'Sem bloqueios', tone: snapshot.watchdog.openIssues > 0 ? 'warning' : 'positive' })}
          </div>
          <ul>
            ${
              snapshot.watchdog.recentIssues.length > 0
                ? snapshot.watchdog.recentIssues
                    .map(
                      (issue) =>
                        `<li><strong>${escapeHtml(issue.groupLabel)}</strong>: ${escapeHtml(issue.summary)} ${renderUiBadge({ label: formatShortDateTime(issue.openedAt), tone: 'warning', style: 'chip' })}</li>`,
                    )
                    .join('')
                : '<li>Sem issues abertas neste momento.</li>'
            }
          </ul>
        </article>

        <article class="surface content-card span-6">
          <div class="card-header">
            <h3>Saude do sistema</h3>
            ${renderUiBadge({ label: snapshot.health.status, tone: toneFromHealth(snapshot.health.status) })}
          </div>
          <ul>
            <li>Jobs pendentes: ${snapshot.health.jobs.pending}</li>
            <li>A espera de confirmacao: ${snapshot.health.jobs.waitingConfirmation}</li>
            <li>Enviados: ${snapshot.health.jobs.sent}</li>
            ${snapshot.health.modules
              .map(
                (module, index) =>
                  `<li>Modulo ${index + 1}: ${escapeHtml(module.status)}${module.details ? ` (${escapeHtml(JSON.stringify(module.details))})` : ''}</li>`,
              )
              .join('')}
          </ul>
        </article>
      </section>
    `;
  }

  private renderWeekPage(page: UiPage<WeekPlannerSnapshot>): string {
    const groups = page.data.groups;
    const draft = resolveScheduleDraft(this.state.scheduleDraft, groups);
    const selectedGroup = groups.find((group) => group.groupJid === draft.groupJid) ?? null;
    const editingEvent = page.data.events.find((event) => event.eventId === draft.eventId) ?? null;
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
          <p class="eyebrow">Criar agendamento</p>
          <h2>Fluxo guiado para montar ou ajustar um agendamento sem mexer em termos internos.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({
              label: editingEvent ? 'Guardar alteracoes' : 'Criar agendamento',
              dataAttributes: { 'flow-action': 'schedule-save' },
            })}
            ${renderUiActionButton({
              label: 'Limpar formulario',
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
            contentHtml: `<p>${escapeHtml(`${page.data.focusWeekRangeLabel}. Timezone ${page.data.timezone}. ${groups.length} grupos prontos para usar neste fluxo.`)}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Estado live',
            badgeLabel: `${page.data.diagnostics.eventCount} eventos`,
            badgeTone: page.data.diagnostics.eventCount > 0 ? 'positive' : 'neutral',
            contentHtml: `<p>${escapeHtml(
              `${page.data.diagnostics.pendingNotifications} avisos pendentes, ${page.data.diagnostics.waitingConfirmationNotifications} a aguardar confirmacao e ${page.data.diagnostics.sentNotifications} enviados.`,
            )}</p>`,
          })}
        </div>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-7">
          <div class="card-header">
            <h3>Passo 1. Dados base do agendamento</h3>
            ${renderUiBadge({
              label: editingEvent ? 'A editar evento real' : selectedGroup ? 'Pronto para gravar' : 'Escolhe um grupo',
              tone: editingEvent || selectedGroup ? 'positive' : 'warning',
            })}
          </div>
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
              options: [
                { value: 'segunda-feira', label: 'Segunda-feira' },
                { value: 'terca-feira', label: 'Terca-feira' },
                { value: 'quarta-feira', label: 'Quarta-feira' },
                { value: 'quinta-feira', label: 'Quinta-feira' },
                { value: 'sexta-feira', label: 'Sexta-feira' },
                { value: 'sabado', label: 'Sabado' },
              ],
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
              hint: 'Esta nota aparece no preview para veres se a mensagem ficou clara.',
            })}
          </div>
        </article>

        <article class="surface content-card span-5">
          <div class="card-header">
            <h3>Passo 2. Preview humano</h3>
            ${renderUiBadge({ label: editingEvent ? 'Edicao live' : 'Antes de confirmar', tone: editingEvent ? 'positive' : 'neutral' })}
          </div>
          <div class="guide-preview">
            <p><strong>Grupo</strong>: ${escapeHtml(selectedGroup?.preferredSubject ?? 'Escolhe um grupo')}</p>
            <p><strong>Quando</strong>: ${escapeHtml(`${draft.dayLabel}, ${draft.startTime}`)}</p>
            <p><strong>Duracao</strong>: ${escapeHtml(`${draft.durationMinutes} minutos`)}</p>
            <p><strong>Owners</strong>: ${escapeHtml(
              selectedGroup
                ? selectedGroup.ownerLabels.length > 0
                  ? `${selectedGroup.ownerLabels.length} owner(s) definidos`
                  : 'sem owner definido'
                : 'sem owner definido',
            )}</p>
            <p><strong>Mensagem interna</strong>: ${escapeHtml(draft.notes || 'Sem nota adicional.')}</p>
            <div class="ui-card__chips">
              ${notificationLabels.map((label) => renderUiBadge({ label, tone: 'positive', style: 'chip' })).join('')}
            </div>
          </div>
          <ul>
            <li>O fluxo continua a esconder JIDs e IDs da operacao principal.</li>
            <li>Este botao ja grava no backend real da semana atual.</li>
            <li>Podes carregar um evento da agenda abaixo para o editar sem sair desta pagina.</li>
          </ul>
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-8">
          <div class="card-header">
            <h3>Agenda live desta semana</h3>
            ${renderUiBadge({ label: `${page.data.events.length} eventos`, tone: page.data.events.length > 0 ? 'positive' : 'neutral' })}
          </div>
          ${
            page.data.events.length > 0
              ? `
                <div class="card-grid">
                  ${page.data.events
                    .map((event) =>
                      renderUiRecordCard({
                        title: event.title,
                        subtitle: `${event.groupLabel} | ${event.dayLabel}, ${event.startTime}`,
                        badgeLabel:
                          event.notifications.waitingConfirmation > 0
                            ? 'A aguardar confirmacao'
                            : event.notifications.pending > 0
                              ? 'Com avisos pendentes'
                              : 'Estavel',
                        badgeTone:
                          event.notifications.waitingConfirmation > 0
                            ? 'warning'
                            : event.notifications.pending > 0
                              ? 'neutral'
                              : 'positive',
                        chips: [
                          { label: `${event.durationMinutes} min`, tone: 'neutral' },
                          { label: `${event.notificationRuleLabels.length} avisos`, tone: 'positive' },
                        ],
                        bodyHtml: `
                          <ul>
                            <li>Notas: ${escapeHtml(event.notes || 'sem nota')}</li>
                            <li>Pendentes: ${event.notifications.pending}</li>
                            <li>Waiting confirmation: ${event.notifications.waitingConfirmation}</li>
                            <li>Enviados: ${event.notifications.sent}</li>
                          </ul>
                          <div class="action-row">
                            ${renderUiActionButton({
                              label: 'Editar',
                              variant: 'secondary',
                              dataAttributes: {
                                'flow-action': 'schedule-load-event',
                                'flow-value': event.eventId,
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
                <section class="surface placeholder-card">
                  <div>
                    <p class="eyebrow">Agenda vazia</p>
                    <h3>Ainda nao ha eventos gravados nesta semana</h3>
                    <p>Usa o formulario acima para criar o primeiro agendamento real.</p>
                  </div>
                </section>
              `
          }
        </article>

        <article class="surface content-card span-4">
          <div class="card-header">
            <h3>Bases rapidas</h3>
          </div>
          <div class="card-grid">
            ${examples
              .map((example) =>
                renderUiRecordCard({
                  title: example.title,
                  subtitle: example.notes,
                  badgeLabel: example.preview.dayLabel,
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
    const videoCount = assets.filter((asset) => asset.mediaType === 'video').length;
    const selectedGroups = groups.filter((group) => draft.targetGroupJids.includes(group.groupJid));
    const allGroupsSelected = groups.length > 0 && selectedGroups.length === groups.length;
    const recentInstructions = mediaInstructions.slice(0, 6);
    const failedGroupCount = recentInstructions.flatMap((instruction) => instruction.actions).filter((action) => action.status === 'failed').length;

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Biblioteca operacional</p>
          <h2>Escolher um video recebido, selecionar os grupos e disparar a distribuicao sem tocar em payloads tecnicos.</h2>
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
            title: 'Politica atual',
            badgeLabel: 'Manual',
            badgeTone: 'neutral',
            contentHtml: `<p>${escapeHtml(
              latestAsset?.retentionPolicy.description ??
                'A media fica guardada ate limpeza manual nesta ronda, sem expiracao automatica.',
            )}</p>`,
          })}
        </div>
      </section>

      <section class="card-grid">
        ${renderUiMetricCard({
          title: 'Assets guardados',
          value: String(assets.length),
          tone: assets.length > 0 ? 'positive' : 'warning',
          description: 'Total de media recebida que ja entrou no storage canonico.',
        })}
        ${renderUiMetricCard({
          title: 'Videos',
          value: String(videoCount),
          tone: videoCount > 0 ? 'positive' : 'neutral',
          description: 'Videos recebidos que ja podem entrar no fluxo guiado de distribuicao.',
        })}
        ${renderUiMetricCard({
          title: 'Grupos selecionados',
          value: `${selectedGroups.length}/${groups.length}`,
          tone: selectedGroups.length > 0 ? 'positive' : 'warning',
          description: 'Cobertura atual do fan-out manual para o video escolhido.',
        })}
        ${renderUiMetricCard({
          title: 'Distribuicoes media',
          value: String(mediaInstructions.length),
          tone: mediaInstructions.length > 0 ? 'positive' : 'neutral',
          description: 'Runs de media ja registados na queue com tracking por grupo.',
        })}
        ${renderUiMetricCard({
          title: 'Falhas por grupo',
          value: String(failedGroupCount),
          tone: failedGroupCount > 0 ? 'warning' : 'positive',
          description: 'Alvos que ainda ficaram falhados nas ultimas distribuicoes de media.',
        })}
      </section>

      <section class="content-grid">
        <article class="surface content-card span-5">
          <div class="card-header">
            <h3>Passo 1. Escolher video recebido</h3>
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
                    options: (videoAssets.length > 0 ? videoAssets : assets).map((asset) => ({
                      value: asset.assetId,
                      label: `${readableMediaType(asset.mediaType)} • ${asset.caption ?? readableSourceChat(asset.sourceChatJid)}`,
                    })),
                    hint: 'Escolhe primeiro o video recebido que queres reaproveitar para esta distribuicao.',
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
                <div class="card-grid">
                  ${(videoAssets.length > 0 ? videoAssets : assets)
                    .slice(0, 6)
                    .map((asset) =>
                      renderUiRecordCard({
                        title: asset.caption ?? `${readableMediaType(asset.mediaType)} sem caption`,
                        subtitle: `${readableMediaType(asset.mediaType)} • ${asset.mimeType}`,
                        badgeLabel: readableMediaType(asset.mediaType),
                        badgeTone: toneForMediaType(asset.mediaType),
                        chips: [
                          {
                            label: formatFileSize(asset.fileSize),
                            tone: 'neutral',
                          },
                          {
                            label: asset.exists ? 'No disco' : 'Em falta',
                            tone: asset.exists ? 'positive' : 'danger',
                          },
                          {
                            label: readableSourceChat(asset.sourceChatJid),
                            tone: asset.sourceChatJid.endsWith('@g.us') ? 'positive' : 'warning',
                          },
                        ],
                        bodyHtml: `
                          <p><strong>Origem</strong>: ${escapeHtml(readableSourceChat(asset.sourceChatJid))}</p>
                          <p><strong>Mensagem</strong>: ${escapeHtml(asset.sourceMessageId)}</p>
                          <p><strong>Recebido</strong>: ${escapeHtml(formatShortDateTime(asset.storedAt))}</p>
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
                        `,
                        detailsSummary: this.state.advancedDetailsEnabled ? 'Detalhes avancados' : undefined,
                        detailsHtml: this.state.advancedDetailsEnabled
                          ? `
                              <p>Asset ID: ${escapeHtml(asset.assetId)}</p>
                              <p>SHA-256: ${escapeHtml(asset.sha256)}</p>
                              <p>Binary path: ${escapeHtml(asset.binaryPath)}</p>
                              <p>Metadata path: ${escapeHtml(asset.metadataPath)}</p>
                            `
                          : undefined,
                      }),
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
            <h3>Passo 2. Escolher grupos alvo</h3>
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
            <h3>Passo 3. Confirmar e distribuir</h3>
            ${renderUiBadge({
              label: selectedAsset && selectedGroups.length > 0 ? 'Pronto a testar' : 'Faltam escolhas',
              tone: selectedAsset && selectedGroups.length > 0 ? 'positive' : 'warning',
            })}
          </div>
          <div class="content-grid">
            <div class="span-5">
              <div class="ui-form-grid">
                ${renderUiTextAreaField({
                  label: 'Caption para distribuir',
                  value: draft.caption,
                  dataKey: 'media.caption',
                  rows: 4,
                  placeholder: 'Ex.: Video da coreografia final. Confirmem rececao no grupo.',
                  hint: 'Podes reaproveitar a caption original ou ajustar o texto para esta distribuicao.',
                })}
              </div>
            </div>
            <div class="span-7">
              <div class="guide-preview">
                <p><strong>Video</strong>: ${escapeHtml(
                  selectedAsset?.caption ?? (selectedAsset ? `${readableMediaType(selectedAsset.mediaType)} sem caption` : 'Escolhe primeiro um video'),
                )}</p>
                <p><strong>Origem</strong>: ${escapeHtml(
                  selectedAsset ? readableSourceChat(selectedAsset.sourceChatJid) : 'Sem origem selecionada',
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
            </div>
          </div>
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-12">
          <div class="card-header">
            <div>
              <h3>Estado de entrega por grupo</h3>
              <p>Visao recente das distribuicoes de media, com estados por grupo para perceber logo o que entregou e o que falhou.</p>
            </div>
            ${renderUiBadge({
              label: `${recentInstructions.length} run${recentInstructions.length === 1 ? '' : 's'}`,
              tone: recentInstructions.length > 0 ? 'positive' : 'warning',
            })}
          </div>
          ${
            recentInstructions.length > 0
              ? `
                <div class="card-grid">
                  ${recentInstructions
                    .map((instruction) => {
                      const payload = readMediaInstructionPayload(instruction);
                      const asset = payload ? assets.find((candidate) => candidate.assetId === payload.assetId) ?? null : null;

                      return renderUiRecordCard({
                        title: payload?.caption ?? asset?.caption ?? 'Distribuicao de video sem caption',
                        subtitle: `${instruction.mode === 'confirmed' ? 'Envio confirmado' : 'Dry run'} • ${formatShortDateTime(instruction.updatedAt)}`,
                        badgeLabel: instruction.status,
                        badgeTone: toneFromDistribution(instruction.status),
                        chips: [
                          {
                            label: `${instruction.actions.length} grupos`,
                            tone: 'neutral',
                          },
                          {
                            label: asset ? readableMediaType(asset.mediaType) : 'Media',
                            tone: 'positive',
                          },
                        ],
                        bodyHtml: `
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
                        `,
                        detailsSummary: this.state.advancedDetailsEnabled ? 'Detalhes avancados' : undefined,
                        detailsHtml: this.state.advancedDetailsEnabled
                          ? `
                              <p>Instruction ID: ${escapeHtml(instruction.instructionId)}</p>
                              <p>Asset ID: ${escapeHtml(payload?.assetId ?? 'desconhecido')}</p>
                              <p>Source message: ${escapeHtml(instruction.sourceMessageId ?? 'manual')}</p>
                            `
                          : undefined,
                      });
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

  private renderGroupsPage(page: UiPage<GroupManagementPageData>): string {
    const { groups, intelligence, contextPreview } = page.data;
    const selectedGroup =
      groups.find((group) => group.groupJid === this.state.groupManagementDraft.selectedGroupJid) ?? null;
    const selectedDocument =
      intelligence?.knowledge.documents.find(
        (document) => document.documentId === this.state.groupManagementDraft.selectedDocumentId,
      ) ?? null;
    const groupsWithOwners = groups.filter((group) => group.groupOwners.length > 0).length;
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

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Inteligencia por grupo</p>
          <h2>Instrucoes LLM e knowledge base separadas por grupo, sem misturar contexto de aulas parecidas.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({
              label: 'Atualizar preview do contexto',
              dataAttributes: { 'group-action': 'refresh-preview' },
            })}
          ${renderUiActionButton({
              label: 'Ver WhatsApp',
              href: '/whatsapp',
              variant: 'secondary',
              dataAttributes: { route: '/whatsapp' },
            })}
          </div>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Grupo em foco',
            badgeLabel: selectedGroup ? selectedGroup.preferredSubject : 'Escolher grupo',
            badgeTone: selectedGroup ? 'positive' : 'warning',
            contentHtml: `<p>${escapeHtml(
              selectedGroup
                ? `Estavas a editar ${selectedGroup.preferredSubject}. Tudo o que guardares aqui fica isolado neste grupo.`
                : 'Escolhe um grupo para comecar a gerir instrucoes e conhecimento canonico.',
            )}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Fonte das instrucoes',
            badgeLabel: instructionsState,
            badgeTone: instructionsTone,
            contentHtml: `<p>${escapeHtml(
              intelligence?.instructions.source === 'llm_instructions'
                ? 'A LLM ja esta a ler um ficheiro canonico por grupo.'
                : 'Ainda nao ha instrucoes especificas para este grupo.',
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

      <section class="card-grid">
        ${renderUiMetricCard({
          title: 'Grupos visiveis',
          value: String(groups.length),
          tone: 'neutral',
          description: `${groupsWithOwners} com owner definido e ${groups.length - groupsWithOwners} ainda por rever.`,
        })}
        ${renderUiMetricCard({
          title: 'Docs deste grupo',
          value: String(documentCount),
          tone: documentCount > 0 ? 'positive' : 'warning',
          description: 'Cada documento fica fechado dentro da pasta canonica do grupo.',
        })}
        ${renderUiMetricCard({
          title: 'Snippets no preview',
          value: String(previewSnippetCount),
          tone: previewSnippetCount > 0 ? 'positive' : 'neutral',
          description: 'Trechos que a LLM recuperaria agora para esta pergunta.',
        })}
        ${renderUiMetricCard({
          title: 'Instrucoes ativas',
          value: instructionsState,
          tone: instructionsTone,
          description: 'Mostra se o grupo ja esta a usar ficheiro canonico ou se ainda falta criar instrucoes.',
        })}
        ${renderUiMetricCard({
          title: 'Master switch',
          value: page.data.commandSettings.assistantEnabled ? 'Ligado' : 'Desligado',
          tone: page.data.commandSettings.assistantEnabled ? 'positive' : 'warning',
          description: page.data.commandSettings.assistantEnabled
            ? 'O assistente continua ativo para os grupos que estiverem autorizados abaixo.'
            : 'Ativa-o na coluna da direita para voltar a permitir uso por grupos.',
        })}
        ${renderUiMetricCard({
          title: 'Grupos WA autorizados',
          value: `${authorizedGroupJids.length}/${groups.length}`,
          tone: authorizedGroupJids.length > 0 ? 'positive' : 'warning',
          description: 'Cada switch abaixo decide onde o assistente pode operar neste momento.',
        })}
      </section>

      <section class="content-grid">
        <article class="surface content-card span-4">
          <div class="card-header">
            <h3>Grupos e ownership</h3>
            ${renderUiBadge({ label: `${groups.length} grupos`, tone: 'neutral' })}
          </div>
          <div class="timeline">
            ${groups
              .map((group) => {
                const isSelected = group.groupJid === selectedGroup?.groupJid;
                const owners = group.groupOwners.map((owner) => owner.personId.replace('person-', '')).join(', ');
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
                      <div class="ui-card__chips">
                        ${renderUiBadge({
                          label: group.groupOwners.length > 0 ? 'Com owner' : 'Falta owner',
                          tone: group.groupOwners.length > 0 ? 'positive' : 'warning',
                          style: 'chip',
                        })}
                        ${renderUiBadge({
                          label: `ACL owner ${group.calendarAccessPolicy.groupOwner}`,
                          tone: 'neutral',
                          style: 'chip',
                        })}
                      </div>
                      <p>${escapeHtml(owners.length > 0 ? `Owners: ${owners}` : 'Sem owner definido.')}</p>
                    </button>
                    <div class="group-tile__switch">
                      ${renderUiSwitch({
                        label: 'Assistente neste grupo',
                        checked: groupAuthorized,
                        description: page.data.commandSettings.assistantEnabled
                          ? groupAuthorized
                            ? 'Ligado para este grupo.'
                            : 'Desligado so neste grupo.'
                          : 'Desligado pelo master switch.',
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
              <h3>Instrucoes LLM do grupo</h3>
              <p>Este ficheiro orienta a interpretacao da LLM so para o grupo selecionado.</p>
            </div>
            ${renderUiBadge({ label: instructionsState, tone: instructionsTone })}
          </div>
          ${
            selectedGroup
              ? `
                <div class="ui-form-grid">
                  ${renderUiTextAreaField({
                    label: `Instrucoes canonicas para ${selectedGroup.preferredSubject}`,
                    value: this.state.groupManagementDraft.instructions,
                    dataKey: 'group.instructions',
                    rows: 10,
                    placeholder: 'Ex.: Neste grupo, Aula 1 refere-se sempre ao bloco tecnico base...',
                    hint: 'Tudo o que escreveres aqui fica guardado no ficheiro canonico do grupo.',
                  })}
                  ${renderUiTextAreaField({
                    label: 'Texto para testar o preview',
                    value: this.state.groupManagementDraft.previewText,
                    dataKey: 'group.previewText',
                    rows: 6,
                    placeholder: 'Ex.: A Aula 1 mudou de sala?',
                    hint: 'Serve para veres logo o contexto que o assistente montaria para esta mensagem.',
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
              : '<p>Escolhe um grupo na coluna da esquerda para comecares a editar instrucoes e preview.</p>'
          }
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-5">
          <div class="card-header">
            <div>
              <h3>Knowledge base deste grupo</h3>
              <p>Documentos isolados por grupo, sem contaminar outras turmas.</p>
            </div>
            ${renderUiBadge({
              label: `${documentCount} documento${documentCount === 1 ? '' : 's'}`,
              tone: documentCount > 0 ? 'positive' : 'warning',
            })}
          </div>
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
                          <div class="ui-card__chips">
                            ${renderUiBadge({
                              label: document.enabled ? 'Ativo' : 'Desligado',
                              tone: document.enabled ? 'positive' : 'warning',
                              style: 'chip',
                            })}
                            ${document.tags.map((tag) => renderUiBadge({ label: tag, tone: 'neutral', style: 'chip' })).join('')}
                          </div>
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
                    <time>Podes guardar o primeiro documento desta knowledge base aqui.</time>
                  </div>
                `
            }
          </div>
        </article>

        <article class="surface content-card span-7">
          <div class="card-header">
            <div>
              <h3>Editor do documento</h3>
              <p>O objetivo aqui e manter cada norma ou conhecimento dentro da pasta do proprio grupo.</p>
            </div>
            ${renderUiBadge({
              label: this.state.groupManagementDraft.selectedDocumentId ? 'Documento existente' : 'Novo documento',
              tone: this.state.groupManagementDraft.selectedDocumentId ? 'positive' : 'neutral',
            })}
          </div>
          ${
            selectedGroup
              ? `
                <div class="ui-form-grid ui-form-grid--triple">
                  ${renderUiInputField({
                    label: 'Document ID',
                    value: this.state.groupManagementDraft.knowledgeDocument.documentId,
                    dataKey: 'group.documentId',
                    placeholder: 'ex.: aula-1-ballet',
                    hint: 'Identificador estavel para queue, preview e auditoria.',
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
              `
              : '<p>Escolhe primeiro um grupo para comecares a gerir documentos de conhecimento.</p>'
          }
        </article>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-12">
          <div class="card-header">
            <div>
              <h3>Preview do contexto que a LLM receberia</h3>
              <p>Serve para confirmar rapidamente se instrucoes e snippets estao a puxar o contexto certo do grupo.</p>
            </div>
            ${renderUiBadge({
              label: `${previewSnippetCount} snippet${previewSnippetCount === 1 ? '' : 's'}`,
              tone: previewSnippetCount > 0 ? 'positive' : 'neutral',
            })}
          </div>
          ${
            contextPreview
              ? `
                <div class="card-grid">
                  ${renderUiPanelCard({
                    title: 'Mensagem em teste',
                    badgeLabel: contextPreview.groupInstructionsSource,
                    badgeTone: instructionsTone,
                    contentHtml: `<p>${escapeHtml(contextPreview.currentText || 'Sem texto de teste ainda.')}</p>`,
                  })}
                  ${renderUiPanelCard({
                    title: 'Grupo resolvido',
                    badgeLabel: contextPreview.group?.preferredSubject ?? 'Sem grupo',
                    badgeTone: contextPreview.group ? 'positive' : 'warning',
                    contentHtml: `<p>${escapeHtml(
                      contextPreview.group
                        ? `Aliases: ${contextPreview.group.aliases.join(', ') || 'sem aliases'}.`
                        : 'O preview ainda nao conseguiu resolver um grupo valido.',
                    )}</p>`,
                  })}
                  ${renderUiPanelCard({
                    title: 'Instrucoes ativas',
                    badgeLabel: contextPreview.groupInstructionsSource,
                    badgeTone: instructionsTone,
                    contentHtml: `<p>${escapeHtml(
                      contextPreview.groupInstructions?.trim().slice(0, 220) || 'Ainda nao ha instrucoes especificas para este grupo.',
                    )}</p>`,
                  })}
                </div>
                <div class="card-grid">
                  ${
                    contextPreview.groupKnowledgeSnippets.length > 0
                      ? contextPreview.groupKnowledgeSnippets
                          .map((snippet) =>
                            renderUiRecordCard({
                              title: snippet.title,
                              subtitle: snippet.filePath,
                              badgeLabel: `${snippet.score} match`,
                              badgeTone: 'positive',
                              chips: snippet.matchedTerms.map((term) => ({ label: term, tone: 'neutral' })),
                              bodyHtml: `<p>${escapeHtml(snippet.excerpt)}</p>`,
                              detailsSummary: this.state.advancedDetailsEnabled ? 'Detalhes avancados' : undefined,
                              detailsHtml: this.state.advancedDetailsEnabled
                                ? `<p>Path absoluto: ${escapeHtml(snippet.absoluteFilePath)}</p>`
                                : undefined,
                            }),
                          )
                          .join('')
                      : renderUiPanelCard({
                          title: 'Sem snippets relevantes',
                          badgeLabel: '0 matches',
                          badgeTone: 'warning',
                          contentHtml:
                            '<p>Experimenta escrever outra pergunta ou enriquecer os documentos deste grupo para melhorar o retrieval.</p>',
                        })
                  }
                </div>
              `
              : '<p>Atualiza o preview para veres aqui o contexto efetivo do grupo selecionado.</p>'
          }
        </article>
      </section>
    `;
  }

  private renderWhatsAppPage(page: UiPage<WhatsAppManagementPageData>): string {
    const snapshot = page.data.workspace;
    const people = buildWorkspacePeople(page.data);
    const liveQrVisible = this.state.whatsappQrPreviewVisible && snapshot.runtime.qr.available && snapshot.runtime.qr.svg;

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Canal WhatsApp</p>
          <h2>Ligacao, onboarding, ownership e ACL tratados como operacao humana e nao como configuracao tecnica.</h2>
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
            ${renderUiActionButton({ label: 'Ver configuracao', href: '/settings', variant: 'secondary', dataAttributes: { route: '/settings' } })}
          </div>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Sessao atual',
            badgeLabel: readableSessionPhase(snapshot.runtime.session.phase),
            badgeTone: toneForSessionPhase(snapshot.runtime.session.phase),
            contentHtml: `<p>${escapeHtml(
              snapshot.runtime.session.connected
                ? 'A sessao WhatsApp esta aberta e pronta para descoberta e envio real.'
                : snapshot.runtime.session.loginRequired
                  ? 'Ainda falta autenticar a sessao. Assim que o QR aparecer, ja consegues ligar a conta operadora.'
                  : 'A ligacao existe mas ainda nao esta operacional. Vale a pena confirmar QR, reconnect e discovery.',
            )}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Onboarding',
            badgeLabel: snapshot.runtime.qr.available ? 'QR pronto' : 'Guia pronto',
            badgeTone: snapshot.runtime.qr.available ? 'positive' : 'neutral',
            contentHtml: `<p>${escapeHtml(
              snapshot.runtime.qr.available
                ? 'O backend ja publicou um QR real. Se abrires a area abaixo, consegues validar a clareza do fluxo com o dado live.'
                : 'Abertura da sessao, diagnostico e recuperacao ficam explicados sem linguagem interna.',
            )}</p>`,
          })}
        </div>
      </section>

      <section class="card-grid">
        ${renderUiMetricCard({ title: 'Grupos autorizados', value: `${snapshot.permissionSummary.authorizedGroups}/${snapshot.permissionSummary.knownGroups}`, tone: 'neutral', description: 'Cobertura atual do assistente nos grupos conhecidos.' })}
        ${renderUiMetricCard({ title: 'Privados autorizados', value: `${snapshot.permissionSummary.authorizedPrivateConversations}/${snapshot.permissionSummary.knownPrivateConversations}`, tone: 'neutral', description: 'Conversas privadas onde o assistente pode responder.' })}
        ${renderUiMetricCard({ title: 'App owners', value: String(snapshot.permissionSummary.appOwners), tone: 'positive', description: 'Pessoas com controlo global da aplicacao.' })}
        ${renderUiMetricCard({ title: 'Sessao live', value: readableSessionPhase(snapshot.runtime.session.phase), tone: toneForSessionPhase(snapshot.runtime.session.phase), description: 'Estado real da ligacao WhatsApp neste momento.' })}
        ${renderUiMetricCard({ title: 'Descobertos live', value: `${snapshot.runtime.discoveredGroups}/${snapshot.runtime.discoveredConversations}`, tone: 'neutral', description: 'Grupos e privados descobertos pelo runtime real.' })}
        ${renderUiMetricCard({ title: 'Mesmo auth do Codex', value: snapshot.host.sameAsCodexCanonical ? 'Sim' : 'Nao', tone: snapshot.host.sameAsCodexCanonical ? 'positive' : 'warning', description: 'Partilha do auth live com o ambiente principal.' })}
        ${renderUiMetricCard({ title: 'Pessoas visiveis', value: String(people.length), tone: 'neutral', description: 'Base humana para gerir owners e acessos.' })}
      </section>

      <section class="content-grid">
        <article class="surface content-card span-12">
          <div class="card-header">
            <h3>Fluxo guiado para ligar ou reparar WhatsApp</h3>
            ${renderUiBadge({ label: readableRepairFocus(this.state.whatsappRepairFocus), tone: repairTone(this.state.whatsappRepairFocus, snapshot) })}
          </div>
          <div class="action-row">
            ${renderUiActionButton({
              label: 'Auth',
              variant: this.state.whatsappRepairFocus === 'auth' ? 'primary' : 'secondary',
              dataAttributes: { 'flow-action': 'repair-focus', 'flow-value': 'auth' },
            })}
            ${renderUiActionButton({
              label: 'Grupos',
              variant: this.state.whatsappRepairFocus === 'groups' ? 'primary' : 'secondary',
              dataAttributes: { 'flow-action': 'repair-focus', 'flow-value': 'groups' },
            })}
            ${renderUiActionButton({
              label: 'Permissoes',
              variant: this.state.whatsappRepairFocus === 'permissions' ? 'primary' : 'secondary',
              dataAttributes: { 'flow-action': 'repair-focus', 'flow-value': 'permissions' },
            })}
          </div>
          <div class="content-grid">
            <article class="surface content-card span-7">
              <div class="card-header">
                <h3>Passos recomendados</h3>
              </div>
              ${renderRepairChecklist(this.state.whatsappRepairFocus, snapshot)}
            </article>
            <article class="surface content-card span-5">
              <div class="card-header">
                <h3>Leitura rapida do estado</h3>
              </div>
              <ul>
                <li>Fase da sessao: ${escapeHtml(readableSessionPhase(snapshot.runtime.session.phase))}</li>
                <li>Auth presente: ${snapshot.runtime.session.sessionPresent ? 'sim' : 'nao'}</li>
                <li>QR disponivel: ${snapshot.runtime.qr.available ? 'sim' : 'nao'}</li>
                <li>Descoberta de grupos: ${snapshot.settings.whatsapp.groupDiscoveryEnabled ? 'ativa' : 'desligada'}</li>
                <li>Descoberta de conversas: ${snapshot.settings.whatsapp.conversationDiscoveryEnabled ? 'ativa' : 'desligada'}</li>
                <li>Assistente privado: ${snapshot.settings.commands.allowPrivateAssistant ? 'permitido' : 'bloqueado'}</li>
                <li>Ultima discovery: ${escapeHtml(formatShortDateTime(snapshot.runtime.lastDiscoveryAt))}</li>
              </ul>
            </article>
          </div>
        </article>

        <article class="surface content-card span-6">
          <div class="card-header">
            <h3>Onboarding e controlos da sessao</h3>
            ${renderUiBadge({ label: readableSessionPhase(snapshot.runtime.session.phase), tone: toneForSessionPhase(snapshot.runtime.session.phase) })}
          </div>
          <div class="ui-card__content">
            ${liveQrVisible ? `
              <div class="qr-preview">
                <div class="qr-preview__code qr-preview__code--svg" aria-label="QR de emparelhamento live do WhatsApp">${snapshot.runtime.qr.svg ?? ''}</div>
                <div class="qr-preview__body">
                  <strong>QR live pronto para scan</strong>
                  <p>Aponta o telemovel da conta operadora a este QR grande para autenticar a sessao real do LumeHub sem precisares de zoom manual.</p>
                  <p>Gerado: ${escapeHtml(formatShortDateTime(snapshot.runtime.qr.updatedAt))}</p>
                  <div class="action-row qr-preview__actions">
                    <a class="ui-button ui-button--secondary" href="/api/qr.svg" target="_blank" rel="noreferrer noopener">Abrir QR isolado</a>
                  </div>
                </div>
              </div>
            ` : `
              <div class="guide-preview">
                <p><strong>Quando mostrar QR</strong>: quando o auth faltar, expirar ou precisares de trocar de conta.</p>
                <p><strong>Depois do scan</strong>: confirmar fase open, descoberta live e permissoes base.</p>
                <p><strong>Estado atual</strong>: ${escapeHtml(snapshot.runtime.session.lastError ?? 'sem erro live conhecido')}</p>
              </div>
            `}
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
        </article>

        <article class="surface content-card span-6">
          <div class="card-header">
            <h3>Pessoas, app owners e acesso privado</h3>
            ${renderUiBadge({ label: `${people.filter((person) => person.personId).length} pessoas geriveis`, tone: 'neutral' })}
          </div>
          <div class="card-grid">
            ${people
              .map((person) =>
                renderUiRecordCard({
                  title: person.displayName,
                  subtitle:
                    person.whatsappJids.length > 0
                      ? `${person.whatsappJids.length} contacto(s) WhatsApp conhecido(s)`
                      : 'Sem contacto WhatsApp conhecido',
                  badgeLabel: person.globalRoles.includes('app_owner') ? 'App owner' : 'Membro',
                  badgeTone: person.globalRoles.includes('app_owner') ? 'positive' : 'neutral',
                  chips: [
                    {
                      label: person.privateAssistantAuthorized ? 'Privado permitido' : 'Privado bloqueado',
                      tone: person.privateAssistantAuthorized ? 'positive' : 'warning',
                    },
                    ...(person.ownedGroupJids.length > 0
                      ? [{ label: `${person.ownedGroupJids.length} grupos associados`, tone: 'neutral' as const }]
                      : []),
                  ],
                  bodyHtml: `
                    <div class="action-row">
                      ${
                        person.personId
                          ? renderUiActionButton({
                              label: person.globalRoles.includes('app_owner') ? 'Remover app owner' : 'Tornar app owner',
                              variant: person.globalRoles.includes('app_owner') ? 'secondary' : 'primary',
                              dataAttributes: {
                                'whatsapp-action': 'toggle-app-owner',
                                'person-id': person.personId,
                              },
                            })
                          : ''
                      }
                      ${
                        person.personId && person.whatsappJids.length > 0
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
                  `,
                  detailsSummary: this.state.advancedDetailsEnabled ? 'Detalhes avancados' : undefined,
                  detailsHtml: this.state.advancedDetailsEnabled
                    ? `
                        <p>JIDs: ${escapeHtml(person.whatsappJids.join(', ') || 'sem JID')}</p>
                        <p>Conhecido pelo bot: ${person.knownToBot ? 'sim' : 'nao'}</p>
                      `
                    : undefined,
                }),
              )
              .join('')}
          </div>
        </article>

        <article class="surface content-card span-12">
          <div class="card-header">
            <h3>Grupos, responsaveis e acesso ao calendario</h3>
            ${renderUiBadge({ label: 'Gestao visual direta', tone: 'positive' })}
          </div>
          <div class="group-access-grid">
            ${snapshot.groups
              .map(
                (group) => `
                  ${renderUiRecordCard({
                    title: group.preferredSubject,
                    subtitle: group.ownerLabels.join(', ') || 'Sem responsavel definido',
                    badgeLabel: group.assistantAuthorized ? 'Assistente ativo' : 'Acesso bloqueado',
                    badgeTone: group.assistantAuthorized ? 'positive' : 'warning',
                    bodyHtml: `
                      <div class="ui-card__content">
                        <p><strong>Responsaveis atuais</strong>: ${escapeHtml(group.ownerLabels.join(', ') || 'nenhum')}</p>
                        <div class="action-row">
                          ${renderUiActionButton({
                            label: group.assistantAuthorized ? 'Bloquear grupo' : 'Autorizar grupo',
                            variant: group.assistantAuthorized ? 'secondary' : 'primary',
                            dataAttributes: {
                              'whatsapp-action': 'toggle-group-authorized',
                              'group-jid': group.groupJid,
                            },
                          })}
                          ${group.ownerPersonIds.length > 0
                            ? renderUiActionButton({
                                label: 'Limpar responsaveis',
                                variant: 'secondary',
                                dataAttributes: {
                                  'whatsapp-action': 'clear-group-owners',
                                  'group-jid': group.groupJid,
                                },
                              })
                            : ''
                          }
                        </div>
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
                        <div class="acl-access-note">
                          <strong>Acesso ao calendario</strong>
                          <p><strong>So ver</strong> consulta. <strong>Ver e editar</strong> cria, altera e apaga eventos deste grupo.</p>
                        </div>
                        <div class="acl-access-list">
                          ${renderWhatsAppAclField(group.groupJid, 'group', group.calendarAccessPolicy.group)}
                          ${renderWhatsAppAclField(group.groupJid, 'groupOwner', group.calendarAccessPolicy.groupOwner)}
                          ${renderWhatsAppAclField(group.groupJid, 'appOwner', group.calendarAccessPolicy.appOwner)}
                        </div>
                      </div>
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
        <article class="surface content-card span-12">
          <div class="card-header">
            <h3>Conversas privadas</h3>
          </div>
          <div class="card-grid">
            ${snapshot.conversations
              .map(
                (conversation) => `
                  ${renderUiRecordCard({
                    title: conversation.displayName,
                    subtitle:
                      conversation.ownedGroupJids.length > 0
                        ? `${conversation.ownedGroupJids.length} grupos associados`
                        : 'Sem grupos associados',
                    badgeLabel: conversation.privateAssistantAuthorized ? 'Acesso privado' : 'Sem acesso',
                    badgeTone: conversation.privateAssistantAuthorized ? 'positive' : 'warning',
                    detailsSummary: this.state.advancedDetailsEnabled ? 'Detalhes avancados' : undefined,
                    detailsHtml: this.state.advancedDetailsEnabled
                      ? `
                          <p>JIDs: ${escapeHtml(conversation.whatsappJids.join(', ') || 'sem JID')}</p>
                          <p>Roles globais: ${escapeHtml(conversation.globalRoles.join(', '))}</p>
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

  private renderSettingsPage(page: UiPage<SettingsSnapshot>): string {
    const snapshot = page.data;

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Configuracao</p>
          <h2>Defaults, energia, host e auth organizados com mais clareza visual.</h2>
          <p>${escapeHtml(page.description)}</p>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Defaults ativos',
            badgeLabel: `${snapshot.adminSettings.ui.defaultNotificationRules.length} regras`,
            badgeTone: 'neutral',
            contentHtml: '<p>As regras default continuam visiveis sem obrigar a ler ficheiros ou JSON.</p>',
          })}
        </div>
      </section>
      <section class="content-grid">
        <article class="surface content-card span-4">
          <div class="card-header">
            <h3>Avisos default</h3>
          </div>
          <ul>
            ${snapshot.adminSettings.ui.defaultNotificationRules
              .map(
                (rule) =>
                  `<li>${escapeHtml(rule.label ?? rule.kind)} - ${escapeHtml(rule.localTime ?? `${rule.daysBeforeEvent ?? 0}d / ${rule.offsetMinutesBeforeEvent ?? 0}m`)}</li>`,
              )
              .join('')}
          </ul>
        </article>

        <article class="surface content-card span-4">
          <div class="card-header">
            <h3>Energia</h3>
            ${renderUiBadge({ label: snapshot.powerStatus.inhibitorActive ? 'A impedir sleep' : 'Sem inibicao', tone: snapshot.powerStatus.inhibitorActive ? 'warning' : 'neutral' })}
          </div>
          <ul>
            <li>Modo: ${escapeHtml(snapshot.powerStatus.policy.mode)}</li>
            <li>Politica ativa: ${snapshot.powerStatus.policy.enabled ? 'sim' : 'nao'}</li>
            <li>Razoes: ${escapeHtml(snapshot.powerStatus.reasons.join(', ') || 'nenhuma')}</li>
          </ul>
        </article>

        <article class="surface content-card span-4">
          <div class="card-header">
            <h3>Host e auth</h3>
            ${renderUiBadge({ label: snapshot.hostStatus.autostart.enabled ? 'Autostart ligado' : 'Autostart desligado', tone: snapshot.hostStatus.autostart.enabled ? 'positive' : 'warning' })}
          </div>
          <ul>
            <li>Auth live presente: ${snapshot.hostStatus.auth.exists ? 'sim' : 'nao'}</li>
            <li>Mesmo auth do Codex: ${snapshot.hostStatus.auth.sameAsCodexCanonical ? 'sim' : 'nao'}</li>
            <li>Heartbeat: ${escapeHtml(formatShortDateTime(snapshot.hostStatus.runtime.lastHeartbeatAt))}</li>
          </ul>
          ${
            this.state.advancedDetailsEnabled
              ? `
                  <details class="details">
                    <summary>Detalhes avancados</summary>
                    <p>Auth file: ${escapeHtml(snapshot.hostStatus.auth.filePath)}</p>
                    <p>Service: ${escapeHtml(snapshot.hostStatus.autostart.serviceName)}</p>
                  </details>
                `
              : ''
          }
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

  private async handleFlowAction(action: string, value?: string): Promise<void> {
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

  private readMediaPageData(): UiPage<MediaLibraryPageData> | null {
    const page = this.state.page as UiPage<MediaLibraryPageData> | null;

    if (!page || page.route !== '/media') {
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

  private readWhatsAppPageData(): WhatsAppManagementPageData | null {
    const page = this.state.page as UiPage<WhatsAppManagementPageData> | null;

    if (!page || page.route !== '/whatsapp') {
      return null;
    }

    return page.data;
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

  private renderContextRailCards(currentRoute: AppRouteDefinition): string {
    if (currentRoute.route !== '/groups') {
      return '';
    }

    const page = this.readGroupManagementPageData();

    if (!page) {
      return '';
    }

    const activeGroups = resolveAuthorizedGroupJidsForCommands(page.data.groups, page.data.commandSettings).length;

    return `
      <section class="surface rail-card">
        <h3>Master switch dos grupos</h3>
        <p>Este controlo corta ou reabre o assistente nos grupos WhatsApp sem mexer nas instrucoes nem na knowledge base.</p>
        ${renderUiSwitch({
          label: 'Assistente ativo para grupos',
          checked: page.data.commandSettings.assistantEnabled,
          description: page.data.commandSettings.assistantEnabled
            ? `${activeGroups} grupo(s) WA continuam autorizados neste momento.`
            : 'Neste momento nenhum grupo pode usar o assistente ate voltares a ligar.',
          dataAttributes: {
            'group-action': 'toggle-assistant-master',
          },
        })}
      </section>
    `;
  }

  private renderAssistantRail(currentRoute: AppRouteDefinition): string {
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
            <p>Escreve uma pergunta para conversar em global ou simular o contexto de um grupo sem responder no WhatsApp.</p>
          </div>
        `;

    return `
      ${this.renderContextRailCards(currentRoute)}
      <section class="surface rail-card rail-chat-card">
        <div class="rail-chat-card__header">
          <div>
            <h3>Chat lateral com a LLM</h3>
            <p>Conversa aqui na interface. Podes falar em modo global ou como se estivesses num grupo, mas a resposta fica sempre no chat local.</p>
          </div>
          ${renderUiBadge({
            label: this.state.assistantRailChat.sending ? 'A responder' : `Contexto ${contextLabel}`,
            tone: this.state.assistantRailChat.sending ? 'warning' : 'positive',
          })}
        </div>

        <div class="rail-chat-stack">
          <div class="rail-chat-toolbar">
            <div class="rail-chat-toolbar__group">
              <span class="eyebrow">Dados</span>
              <div class="control-row">
                ${renderUiToggleButton({ label: 'Demo', value: 'demo', active: this.state.mode === 'demo', kind: 'mode' })}
                ${renderUiToggleButton({ label: 'Live', value: 'live', active: this.state.mode === 'live', kind: 'mode' })}
              </div>
            </div>
            <div class="rail-chat-toolbar__group">
              <span class="eyebrow">Leitura</span>
              <div class="control-row">
                ${renderUiToggleButton({
                  label: 'Essencial',
                  value: 'essential',
                  active: !this.state.advancedDetailsEnabled,
                  kind: 'details-mode',
                })}
                ${renderUiToggleButton({
                  label: 'Advanced',
                  value: 'advanced',
                  active: this.state.advancedDetailsEnabled,
                  kind: 'details-mode',
                })}
              </div>
            </div>
            <div class="rail-chat-toolbar__group">
              <span class="eyebrow">Contexto</span>
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
                        hint: 'A LLM recebe as instrucoes e a knowledge base deste grupo, mas responde aqui no chat lateral.',
                      })
                    : `
                      <div class="rail-chat-inline-note">
                        <strong>${this.state.assistantRailChat.loadingGroups ? 'A carregar grupos...' : 'Sem grupos disponiveis agora'}</strong>
                        <p>${
                          this.state.assistantRailChat.loadingGroups
                            ? 'Assim que os grupos entrarem no runtime, o seletor fica disponivel.'
                            : 'Muda para Global ou volta a carregar quando o backend listar grupos conhecidos.'
                        }</p>
                      </div>
                    `
                }
              `
              : `
                <div class="rail-chat-inline-note">
                  <strong>Chat global ativo</strong>
                  <p>A resposta usa contexto geral do produto e da pagina atual, sem assumir um grupo WhatsApp especifico.</p>
                </div>
              `
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
              <span class="ui-field__hint">Enter envia. Shift + Enter cria nova linha. Alt + D continua a alternar o modo de leitura.</span>
            </label>

            <div class="rail-chat-actions">
              ${renderUiActionButton({
                label: this.state.assistantRailChat.sending ? 'A responder...' : 'Perguntar a LLM',
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

        this.state = {
          ...this.state,
          pendingConfirmation: null,
          route: this.currentRouter().normalizeRoute(nextRoute),
        };
        void this.loadCurrentRoute();
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
  return [
    {
      messageId: 'rail-chat-welcome',
      role: 'system',
      text: 'Este chat lateral responde sempre aqui na web app. Podes perguntar em modo global ou com o contexto de qualquer grupo.',
      contextLabel: 'Local',
      recordedAt: new Date().toISOString(),
    },
  ];
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

function createPreviewPage(route: AppRouteDefinition, previewState: PreviewState): UiPage<null> {
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

function shouldAutoRefreshRoute(route: string, topic: string): boolean {
  if (topic.startsWith('media.')) {
    return route === '/media' || route === '/whatsapp';
  }

  if (topic.startsWith('routing.') || topic.startsWith('instruction.')) {
    return route === '/media' || route === '/distributions' || route === '/today';
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
      <label class="acl-access-row__control">
        <span class="ui-field__label">Acesso</span>
        <select
          class="ui-control"
          aria-label="Nivel de acesso para ${escapeHtml(scopeLabel)}"
          data-whatsapp-acl-group-jid="${escapeHtml(groupJid)}"
          data-whatsapp-acl-scope="${escapeHtml(scope)}"
        >
          <option value="read"${currentValue === 'read' ? ' selected' : ''}>So ver</option>
          <option value="read_write"${currentValue === 'read_write' ? ' selected' : ''}>Ver e editar</option>
        </select>
        <span class="ui-field__hint">${escapeHtml(describeCalendarAccessModeHint(currentValue))}</span>
      </label>
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
      return 'Administrador';
  }
}

function describeCalendarAccessModeHint(value: CalendarAccessMode): string {
  return value === 'read_write'
    ? 'Pode consultar, criar, alterar e apagar eventos neste calendario.'
    : 'Pode consultar o calendario, mas nao consegue alterar eventos.';
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
      return 'Quem participa neste grupo sem ser responsavel.';
    case 'groupOwner':
      return 'Pessoa responsavel por este grupo.';
    case 'appOwner':
      return 'Administrador global do LumeHub neste grupo.';
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

function formatHeaderDate(value: Date): string {
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(value);
}

function looksOffline(message: string): boolean {
  const value = message.toLowerCase();
  return value.includes('failed to fetch') || value.includes('network') || value.includes('503') || value.includes('offline');
}
