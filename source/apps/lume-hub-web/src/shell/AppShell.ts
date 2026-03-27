import type {
  CalendarAccessMode,
  DashboardSnapshot,
  DistributionSummary,
  FrontendUiEvent,
  Group,
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
  renderUiTextAreaField,
  renderUiToggleButton,
  type UiPage,
  type UiTone,
} from '@lume-hub/shared-ui';
import type { WeekPlannerSnapshot } from '@lume-hub/week-planner';

import type { FrontendTransportMode } from '../app/BrowserTransportFactory.js';
import type { AppRouteDefinition, AppRouter, WhatsAppManagementPageData } from '../app/AppRouter.js';
import type { WebAppBootstrap } from '../app/WebAppBootstrap.js';

type PreviewState = 'none' | 'loading' | 'empty' | 'offline' | 'error';
type ScreenState = 'loading' | 'ready' | 'empty' | 'offline' | 'error';

interface GuidedScheduleDraft {
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

interface AppShellState {
  readonly mode: FrontendTransportMode;
  readonly previewState: PreviewState;
  readonly route: string;
  readonly screenState: ScreenState;
  readonly page: UiPage | null;
  readonly errorMessage: string | null;
  readonly liveEvents: readonly FrontendUiEvent[];
  readonly lastLoadedAt: string | null;
  readonly scheduleDraft: GuidedScheduleDraft;
  readonly distributionDraft: GuidedDistributionDraft;
  readonly whatsappRepairFocus: 'auth' | 'groups' | 'permissions';
  readonly whatsappQrPreviewVisible: boolean;
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

export class AppShell {
  private root: HTMLElement | null = null;
  private readonly bootstraps = new Map<FrontendTransportMode, WebAppBootstrap>();
  private detachEvents: (() => void) | null = null;
  private activeMode: FrontendTransportMode | null = null;
  private requestToken = 0;

  private state: AppShellState;

  constructor(
    private readonly createBootstrap: (mode: FrontendTransportMode) => WebAppBootstrap,
    initialMode: FrontendTransportMode,
  ) {
    this.state = {
      mode: initialMode,
      previewState: this.readPreviewState(window.location.search),
      route: '/today',
      screenState: 'loading',
      page: null,
      errorMessage: null,
      liveEvents: [],
      lastLoadedAt: null,
      scheduleDraft: {
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
      whatsappRepairFocus: 'auth',
      whatsappQrPreviewVisible: false,
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
    void this.loadCurrentRoute({ replaceHistory: true });
  }

  private readonly handlePopState = (): void => {
    this.state = {
      ...this.state,
      mode: this.readMode(window.location.search),
      previewState: this.readPreviewState(window.location.search),
      route: this.currentRouter().normalizeRoute(window.location.pathname),
    };
    void this.loadCurrentRoute({ replaceHistory: true });
  };

  private currentRouter(): AppRouter {
    return this.getBootstrap(this.state.mode).router;
  }

  private currentBootstrap(): WebAppBootstrap {
    return this.getBootstrap(this.state.mode);
  }

  private currentClient() {
    return this.currentBootstrap().apiClientProvider.getClient();
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
        }) ?? null;
    }

    return bootstrap;
  }

  private async loadCurrentRoute(options: { readonly replaceHistory?: boolean } = {}): Promise<void> {
    const bootstrap = this.getBootstrap(this.state.mode);
    const route = bootstrap.router.resolveRoute(this.state.route);
    const token = ++this.requestToken;

    this.syncUrl(options.replaceHistory ?? false);

    if (this.state.previewState !== 'none') {
      this.state = {
        ...this.state,
        screenState: mapPreviewStateToScreenState(this.state.previewState),
        page: createPreviewPage(route, this.state.previewState),
        errorMessage: this.state.previewState === 'error' ? 'Falha simulada para validar a linguagem do erro.' : null,
        lastLoadedAt: new Date().toISOString(),
      };
      this.render();
      return;
    }

    this.state = {
      ...this.state,
      screenState: 'loading',
      page: null,
      errorMessage: null,
    };
    this.render();

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
      this.render();
    } catch (error) {
      if (token !== this.requestToken) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);

      this.state = {
        ...this.state,
        screenState: looksOffline(message) ? 'offline' : 'error',
        page: null,
        errorMessage: message,
        lastLoadedAt: new Date().toISOString(),
      };
      this.render();
    }
  }

  private async refreshCurrentRouteData(): Promise<void> {
    this.currentBootstrap().queryClient.clear();
    await this.loadCurrentRoute({ replaceHistory: true });
  }

  private render(): void {
    if (!this.root) {
      return;
    }

    const bootstrap = this.getBootstrap(this.state.mode);
    const router = bootstrap.router;
    const currentRoute = router.resolveRoute(this.state.route);
    const navigation = router.navigation();

    document.title = `LumeHub | ${currentRoute.label}`;
    this.root.innerHTML = `
      <div class="app-shell">
        <aside class="shell-nav">
          <section class="surface brand-card">
            <div class="brand-mark">
              <span class="brand-orbit" aria-hidden="true"></span>
              <span>LumeHub</span>
            </div>
            <p>
              Shell operacional moderna para correr o produto com menos friccao, mais clareza e melhor uso do ecra inteiro.
            </p>
          </section>
          <nav class="surface nav-card" aria-label="Navegacao principal">
            ${navigation
              .map(
                (item) => `
                  <a
                    href="${escapeHtml(item.route)}"
                    data-route="${escapeHtml(item.route)}"
                    class="nav-link ${item.route === currentRoute.route ? 'is-active' : ''}"
                  >
                    <span>
                      <span class="nav-link-label">${escapeHtml(item.label)}</span>
                    </span>
                    <span class="nav-link-kicker">${item.route === currentRoute.route ? 'Agora' : 'Abrir'}</span>
                  </a>
                `,
              )
              .join('')}
          </nav>
        </aside>

        <div class="shell-main">
          <header class="surface shell-header surface--strong">
            <div class="header-copy">
              <p class="eyebrow">Wave 15</p>
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

          <main class="page-stack">
            ${this.state.flowFeedback ? `<section class="surface flow-feedback flow-feedback--${this.state.flowFeedback.tone}"><p>${escapeHtml(this.state.flowFeedback.message)}</p></section>` : ''}
            ${this.renderMainContent(currentRoute)}
          </main>
        </div>

        <aside class="shell-rail">
          <section class="surface rail-card">
            <h3>Modo de dados</h3>
            <p>Escolhe entre preview demo segura e tentativa de ligacao live ao backend real.</p>
            <div class="control-row">
              ${renderUiToggleButton({ label: 'Demo', value: 'demo', active: this.state.mode === 'demo', kind: 'mode' })}
              ${renderUiToggleButton({ label: 'Live', value: 'live', active: this.state.mode === 'live', kind: 'mode' })}
            </div>
          </section>

          <section class="surface rail-card">
            <h3>Estados de preview</h3>
            <p>Usa estes atalhos para testar linguagem, hierarquia e mensagens sem depender do backend.</p>
            <div class="control-row">
              ${renderUiToggleButton({ label: 'Normal', value: 'none', active: this.state.previewState === 'none', kind: 'preview' })}
              ${renderUiToggleButton({ label: 'Loading', value: 'loading', active: this.state.previewState === 'loading', kind: 'preview' })}
              ${renderUiToggleButton({ label: 'Empty', value: 'empty', active: this.state.previewState === 'empty', kind: 'preview' })}
              ${renderUiToggleButton({ label: 'Offline', value: 'offline', active: this.state.previewState === 'offline', kind: 'preview' })}
              ${renderUiToggleButton({ label: 'Erro', value: 'error', active: this.state.previewState === 'error', kind: 'preview' })}
            </div>
          </section>

          <section class="surface rail-card">
            <h3>Foco desta wave</h3>
            <p>
              Nesta wave queremos tornar ownership, ACL e configuracao WhatsApp claros para pessoas com pouco contexto tecnico.
            </p>
            <ul>
              <li>Ver se e obvio quem e app owner, quem e group owner e o que muda entre leitura e leitura com escrita.</li>
              <li>Confirmar que a ligacao WhatsApp mostra estado, causa provavel e proximo passo sugerido.</li>
              <li>Validar se grupos e conversas aparecem com nomes humanos e acoes diretas.</li>
            </ul>
          </section>

          <section class="surface rail-card">
            <h3>Feed recente</h3>
            <p>Pequenos sinais para testar contexto lateral e estados de apoio.</p>
            <div class="timeline">
              ${
                this.state.liveEvents.length > 0
                  ? this.state.liveEvents
                      .map(
                        (event) => `
                          <div class="timeline-item">
                            <strong>${escapeHtml(event.topic)}</strong>
                            <time>${escapeHtml(formatShortDateTime(event.emittedAt))}</time>
                          </div>
                        `,
                      )
                      .join('')
                  : `
                    <div class="timeline-item">
                      <strong>Sem eventos ainda</strong>
                      <time>O rail vai ganhar mais atividade quando houver ligacao live.</time>
                    </div>
                  `
              }
            </div>
          </section>
        </aside>
      </div>
    `;

    this.bindInteractions();
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
      case '/groups':
        return this.renderGroupsPage(this.state.page as UiPage<readonly Group[]>);
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
        ${renderUiMetricCard({ title: 'WhatsApp pronto', value: snapshot.hostCompanion.authExists ? 'Ligado' : 'Desligado', tone: snapshot.hostCompanion.authExists ? 'positive' : 'danger', description: 'Sessao auth e heartbeat do companion.' })}
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
          badgeLabel: snapshot.hostCompanion.authExists ? 'Sessao presente' : 'Precisa de atencao',
          badgeTone: snapshot.hostCompanion.authExists ? 'positive' : 'danger',
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
              label: 'Guardar rascunho',
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
            contentHtml: `<p>${escapeHtml(`Timezone ${page.data.timezone}. ${groups.length} grupos prontos para usar neste fluxo.`)}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Como validar',
            badgeLabel: 'Preview antes de gravar',
            badgeTone: 'positive',
            contentHtml: '<p>Preenche grupo, hora e notas. O preview humano mostra logo o que vai acontecer e quais os avisos associados.</p>',
          })}
        </div>
      </section>

      <section class="content-grid">
        <article class="surface content-card span-7">
          <div class="card-header">
            <h3>Passo 1. Dados base do agendamento</h3>
            ${renderUiBadge({ label: selectedGroup ? 'Pronto para preview' : 'Escolhe um grupo', tone: selectedGroup ? 'positive' : 'warning' })}
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
            ${renderUiBadge({ label: 'Antes de confirmar', tone: 'neutral' })}
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
            <p><strong>Mensagem interna</strong>: ${escapeHtml(draft.notes || 'Sem nota adicional. Vais poder rever isto antes de gravar de forma real numa wave posterior.')}</p>
            <div class="ui-card__chips">
              ${notificationLabels.map((label) => renderUiBadge({ label, tone: 'positive', style: 'chip' })).join('')}
            </div>
          </div>
          <ul>
            <li>O fluxo ja elimina IDs e JIDs da operacao principal.</li>
            <li>O proximo passo de produto sera ligar este formulario aos eventos reais do calendario.</li>
            <li>Para ja, o objetivo e validar compreensao, preview e seguranca de uso.</li>
          </ul>
        </article>
      </section>

      <section class="card-grid">
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
      </section>
    `;
  }

  private renderGroupsPage(page: UiPage<readonly Group[]>): string {
    const groups = page.data;
    const groupsWithOwners = groups.filter((group) => group.groupOwners.length > 0).length;

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Diretorio</p>
          <h2>Grupos visiveis, ownership claro e acesso ao calendario sem linguagem interna.</h2>
          <p>${escapeHtml(page.description)}</p>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Resumo',
            badgeLabel: `${groups.length} grupos`,
            badgeTone: 'neutral',
            contentHtml: `<p>${escapeHtml(
              `${groupsWithOwners} grupos ja tem owner atribuido. ${groups.length - groupsWithOwners} ainda pedem definicao.`,
            )}</p>`,
          })}
        </div>
      </section>
      <section class="card-grid">
        ${groups
          .map(
            (group) =>
              renderUiRecordCard({
                title: group.preferredSubject,
                subtitle: group.courseId ?? 'Sem curso associado',
                badgeLabel: group.groupOwners.length > 0 ? 'Com owner' : 'Falta owner',
                badgeTone: group.groupOwners.length > 0 ? 'positive' : 'warning',
                chips: [
                  { label: `Grupo ${group.calendarAccessPolicy.group}`, tone: 'positive' },
                  { label: `Owner ${group.calendarAccessPolicy.groupOwner}`, tone: 'warning' },
                  { label: `App ${group.calendarAccessPolicy.appOwner}`, tone: 'neutral' },
                ],
                bodyHtml: `
                  <ul>
                    <li>Owners: ${escapeHtml(group.groupOwners.map((owner) => owner.personId.replace('person-', '')).join(', ') || 'nenhum')}</li>
                    <li>Atualizado: ${escapeHtml(formatShortDateTime(group.lastRefreshedAt))}</li>
                    <li>Alias: ${escapeHtml(group.aliases.join(', ') || 'sem alias')}</li>
                  </ul>
                `,
                detailsSummary: 'Detalhes tecnicos',
                detailsHtml: `<p>JID: ${escapeHtml(group.groupJid)}</p>`,
              }),
          )
          .join('')}
      </section>
    `;
  }

  private renderWhatsAppPage(page: UiPage<WhatsAppManagementPageData>): string {
    const snapshot = page.data.workspace;
    const people = buildWorkspacePeople(page.data);

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Canal WhatsApp</p>
          <h2>Ligacao, onboarding, ownership e ACL tratados como operacao humana e nao como configuracao tecnica.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({
              label: this.state.whatsappQrPreviewVisible ? 'Fechar preview QR' : 'Ver onboarding QR',
              dataAttributes: { 'whatsapp-action': 'toggle-qr-preview' },
            })}
            ${renderUiActionButton({ label: 'Ver grupos', href: '/groups', variant: 'secondary', dataAttributes: { route: '/groups' } })}
            ${renderUiActionButton({ label: 'Ver configuracao', href: '/settings', variant: 'secondary', dataAttributes: { route: '/settings' } })}
          </div>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Sessao atual',
            badgeLabel: snapshot.settings.whatsapp.enabled ? 'Ligada' : 'Desligada',
            badgeTone: snapshot.settings.whatsapp.enabled ? 'positive' : 'warning',
            contentHtml: `<p>${escapeHtml(
              snapshot.host.authExists
                ? 'Auth encontrado e pronto para partilhar o mesmo login do Codex.'
                : 'Nao encontrámos auth live. Vale a pena reparar isto antes de confiar no canal.',
            )}</p>`,
          })}
          ${renderUiPanelCard({
            title: 'Onboarding',
            badgeLabel: this.state.whatsappQrPreviewVisible ? 'QR visivel' : 'Guia pronto',
            badgeTone: this.state.whatsappQrPreviewVisible ? 'positive' : 'neutral',
            contentHtml: `<p>${escapeHtml(
              this.state.whatsappQrPreviewVisible
                ? 'Estamos a simular o ponto onde o QR e os passos de ligacao devem aparecer ao operador.'
                : 'Abertura da sessao, diagnostico e recuperacao ficam explicados sem linguagem interna.',
            )}</p>`,
          })}
        </div>
      </section>

      <section class="card-grid">
        ${renderUiMetricCard({ title: 'Grupos autorizados', value: `${snapshot.permissionSummary.authorizedGroups}/${snapshot.permissionSummary.knownGroups}`, tone: 'neutral', description: 'Cobertura atual do assistente nos grupos conhecidos.' })}
        ${renderUiMetricCard({ title: 'Privados autorizados', value: `${snapshot.permissionSummary.authorizedPrivateConversations}/${snapshot.permissionSummary.knownPrivateConversations}`, tone: 'neutral', description: 'Conversas privadas onde o assistente pode responder.' })}
        ${renderUiMetricCard({ title: 'App owners', value: String(snapshot.permissionSummary.appOwners), tone: 'positive', description: 'Pessoas com controlo global da aplicacao.' })}
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
                <li>Auth presente: ${snapshot.host.authExists ? 'sim' : 'nao'}</li>
                <li>Descoberta de grupos: ${snapshot.settings.whatsapp.groupDiscoveryEnabled ? 'ativa' : 'desligada'}</li>
                <li>Descoberta de conversas: ${snapshot.settings.whatsapp.conversationDiscoveryEnabled ? 'ativa' : 'desligada'}</li>
                <li>Assistente privado: ${snapshot.settings.commands.allowPrivateAssistant ? 'permitido' : 'bloqueado'}</li>
              </ul>
            </article>
          </div>
        </article>

        <article class="surface content-card span-5">
          <div class="card-header">
            <h3>Onboarding e controlos da sessao</h3>
            ${renderUiBadge({ label: snapshot.settings.whatsapp.enabled ? 'Canal ativo' : 'Canal desligado', tone: snapshot.settings.whatsapp.enabled ? 'positive' : 'warning' })}
          </div>
          <div class="ui-card__content">
            ${this.state.whatsappQrPreviewVisible ? `
              <div class="qr-preview">
                <div class="qr-preview__code" aria-hidden="true"></div>
                <div>
                  <strong>QR de onboarding</strong>
                  <p>Aponta o telemovel da conta operadora a este QR para ligar a sessao. Esta e uma previsualizacao UX para validar a clareza do fluxo.</p>
                </div>
              </div>
            ` : `
              <div class="guide-preview">
                <p><strong>Quando mostrar QR</strong>: quando o auth faltar, expirar ou precisares de trocar de conta.</p>
                <p><strong>Depois do scan</strong>: confirmar auth, descoberta de grupos e permissoes base.</p>
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

        <article class="surface content-card span-7">
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
                  detailsSummary: 'Detalhes tecnicos',
                  detailsHtml: `
                    <p>JIDs: ${escapeHtml(person.whatsappJids.join(', ') || 'sem JID')}</p>
                    <p>Conhecido pelo bot: ${person.knownToBot ? 'sim' : 'nao'}</p>
                  `,
                }),
              )
              .join('')}
          </div>
        </article>

        <article class="surface content-card span-12">
          <div class="card-header">
            <h3>Grupos, group owners e ACL do calendario</h3>
            ${renderUiBadge({ label: 'Gestao visual direta', tone: 'positive' })}
          </div>
          <div class="card-grid">
            ${snapshot.groups
              .map(
                (group) => `
                  ${renderUiRecordCard({
                    title: group.preferredSubject,
                    subtitle: group.ownerLabels.join(', ') || 'Sem owner definido',
                    badgeLabel: group.assistantAuthorized ? 'Assistente ativo' : 'Acesso bloqueado',
                    badgeTone: group.assistantAuthorized ? 'positive' : 'warning',
                    chips: [
                      { label: `Grupo ${group.calendarAccessPolicy.group}`, tone: 'positive' },
                      { label: `Owner ${group.calendarAccessPolicy.groupOwner}`, tone: 'warning' },
                      { label: `App ${group.calendarAccessPolicy.appOwner}`, tone: 'neutral' },
                    ],
                    bodyHtml: `
                      <div class="ui-card__content">
                        <p><strong>Owners atuais</strong>: ${escapeHtml(group.ownerLabels.join(', ') || 'nenhum')}</p>
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
                                label: 'Limpar owners',
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
                        <div class="ui-form-grid ui-form-grid--triple">
                          ${renderWhatsAppAclField(group.groupJid, 'group', group.calendarAccessPolicy.group, 'Acesso do grupo')}
                          ${renderWhatsAppAclField(group.groupJid, 'groupOwner', group.calendarAccessPolicy.groupOwner, 'Acesso do owner')}
                          ${renderWhatsAppAclField(group.groupJid, 'appOwner', group.calendarAccessPolicy.appOwner, 'Acesso do app owner')}
                        </div>
                      </div>
                    `,
                    detailsSummary: 'Detalhes tecnicos',
                    detailsHtml: `
                      <p>JID: ${escapeHtml(group.groupJid)}</p>
                      <p>Alias: ${escapeHtml(group.aliases.join(', ') || 'sem alias')}</p>
                    `,
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
                    detailsSummary: 'Detalhes tecnicos',
                    detailsHtml: `
                      <p>JIDs: ${escapeHtml(conversation.whatsappJids.join(', ') || 'sem JID')}</p>
                      <p>Roles globais: ${escapeHtml(conversation.globalRoles.join(', '))}</p>
                    `,
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
            <li>O passo seguinte desta area e ligar este preview a execucao real por destino.</li>
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
                    detailsSummary: 'Detalhes tecnicos',
                    detailsHtml: `
                      <p>Instruction ID: ${escapeHtml(distribution.instructionId)}</p>
                      <p>Source message: ${escapeHtml(distribution.sourceMessageId ?? 'manual')}</p>
                    `,
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
                  `<li>${escapeHtml(rule.label ?? rule.kind)} · ${escapeHtml(rule.localTime ?? `${rule.daysBeforeEvent ?? 0}d / ${rule.offsetMinutesBeforeEvent ?? 0}m`)}</li>`,
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
          <details class="details">
            <summary>Detalhes tecnicos</summary>
            <p>Auth file: ${escapeHtml(snapshot.hostStatus.auth.filePath)}</p>
            <p>Service: ${escapeHtml(snapshot.hostStatus.autostart.serviceName)}</p>
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
              '<p>Nesta wave, estamos a validar presenca no menu, clareza visual e uso correto do espaco antes de aprofundar o comportamento.</p>',
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
      default:
        return;
    }
  }

  private handleFlowAction(action: string, value?: string): void {
    if (action === 'schedule-save') {
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'positive',
          message: 'Rascunho de agendamento guardado nesta sessao para continuares a validacao do fluxo.',
        },
      };
      this.render();
      return;
    }

    if (action === 'schedule-clear') {
      this.state = {
        ...this.state,
        scheduleDraft: {
          groupJid: '',
          title: '',
          dayLabel: 'sexta-feira',
          startTime: '18:30',
          durationMinutes: '60',
          notes: '',
        },
        flowFeedback: {
          tone: 'neutral',
          message: 'Formulario de agendamento limpo. Podes testar o fluxo outra vez.',
        },
      };
      this.render();
      return;
    }

    if (action === 'schedule-load-example') {
      const page = this.state.page as UiPage<WeekPlannerSnapshot> | null;

      if (!page || page.route !== '/week' || !value) {
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
      this.render();
      return;
    }

    if (action === 'distribution-save') {
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'positive',
          message: 'Preview de distribuicao preparado. Revê os grupos alvo antes de passar a execucao real.',
        },
      };
      this.render();
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
      this.render();
      return;
    }

    if (action === 'repair-focus' && (value === 'auth' || value === 'groups' || value === 'permissions')) {
      this.state = {
        ...this.state,
        whatsappRepairFocus: value,
        flowFeedback: null,
      };
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
      this.render();
    }
  }

  private readWhatsAppPageData(): WhatsAppManagementPageData | null {
    const page = this.state.page as UiPage<WhatsAppManagementPageData> | null;

    if (!page || page.route !== '/whatsapp') {
      return null;
    }

    return page.data;
  }

  private async runWhatsAppMutation(task: () => Promise<void>, successMessage: string): Promise<void> {
    this.state = {
      ...this.state,
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
        flowFeedback: {
          tone: 'positive',
          message: successMessage,
        },
      };
    } catch (error) {
      this.state = {
        ...this.state,
        flowFeedback: {
          tone: 'danger',
          message: `Nao foi possivel atualizar esta configuracao. ${readErrorMessage(error)}`,
        },
      };
    }

    this.render();
  }

  private async handleWhatsAppAction(action: string, dataset: DOMStringMap): Promise<void> {
    if (action === 'toggle-qr-preview') {
      this.state = {
        ...this.state,
        whatsappQrPreviewVisible: !this.state.whatsappQrPreviewVisible,
        flowFeedback: null,
      };
      this.render();
      return;
    }

    const pageData = this.readWhatsAppPageData();

    if (!pageData) {
      return;
    }

    const snapshot = pageData.workspace;
    const people = buildWorkspacePeople(pageData);

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
          liveEvents: [],
        };
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
        };
        void this.loadCurrentRoute({ replaceHistory: true });
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

        this.handleFlowAction(action, element.dataset.flowValue);
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
  }

  private syncUrl(replaceHistory: boolean): void {
    const params = new URLSearchParams();

    if (this.state.mode === 'live') {
      params.set('mode', 'live');
    }

    if (this.state.previewState !== 'none') {
      params.set('state', this.state.previewState);
    }

    const nextPath = this.currentRouter().resolveRoute(this.state.route).route;
    const nextUrl = `${nextPath}${params.size > 0 ? `?${params.toString()}` : ''}`;

    if (replaceHistory) {
      window.history.replaceState({}, '', nextUrl);
      return;
    }

    window.history.pushState({}, '', nextUrl);
  }

  private readMode(search: string): FrontendTransportMode {
    return new URLSearchParams(search).get('mode') === 'live' ? 'live' : 'demo';
  }

  private readPreviewState(search: string): PreviewState {
    const state = new URLSearchParams(search).get('state');

    if (state === 'loading' || state === 'empty' || state === 'offline' || state === 'error') {
      return state;
    }

    return 'none';
  }
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
    groupJid: selectedGroup?.groupJid ?? '',
    title: draft.title || (selectedGroup ? `Sessao ${selectedGroup.preferredSubject}` : ''),
    dayLabel: draft.dayLabel,
    startTime: draft.startTime,
    durationMinutes: draft.durationMinutes,
    notes: draft.notes,
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
    return snapshot.host.authExists ? 'positive' : 'danger';
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
        <li>Confirmar se o auth partilhado com o Codex existe no host.</li>
        <li>Validar se o companion local tem heartbeat recente.</li>
        <li>Se faltar auth, reabrir a ligacao e voltar a testar antes de mexer em permissoes.</li>
        <li>Estado atual: ${snapshot.host.authExists ? 'auth presente' : 'auth em falta'}.</li>
      </ul>
    `;
  }

  if (focus === 'groups') {
    return `
      <ul>
        <li>Validar se a descoberta de grupos esta ativa.</li>
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

function renderWhatsAppAclField(
  groupJid: string,
  scope: CalendarAccessScope,
  currentValue: CalendarAccessMode,
  label: string,
): string {
  return `
    <label class="ui-field">
      <span class="ui-field__label">${escapeHtml(label)}</span>
      <select
        class="ui-control"
        data-whatsapp-acl-group-jid="${escapeHtml(groupJid)}"
        data-whatsapp-acl-scope="${escapeHtml(scope)}"
      >
        <option value="read"${currentValue === 'read' ? ' selected' : ''}>Leitura</option>
        <option value="read_write"${currentValue === 'read_write' ? ' selected' : ''}>Leitura e escrita</option>
      </select>
      <span class="ui-field__hint">${escapeHtml(describeCalendarScope(scope))}</span>
    </label>
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
  return value === 'read_write' ? 'leitura e escrita' : 'leitura';
}

function describeCalendarScope(scope: CalendarAccessScope): string {
  switch (scope) {
    case 'group':
      return 'Define se o grupo pode apenas ver ou tambem editar o calendario.';
    case 'groupOwner':
      return 'Define o nivel de acesso do owner deste grupo ao calendario.';
    case 'appOwner':
      return 'Define o acesso global do app owner ao calendario deste grupo.';
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
