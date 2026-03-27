import type {
  DashboardSnapshot,
  DistributionSummary,
  FrontendUiEvent,
  Group,
  SettingsSnapshot,
  WhatsAppWorkspaceSnapshot,
  WatchdogIssue,
} from '@lume-hub/frontend-api-client';
import type { RoutingConsoleSnapshot } from '@lume-hub/queue-console';
import {
  escapeHtml,
  renderUiActionButton,
  renderUiBadge,
  renderUiMetricCard,
  renderUiPanelCard,
  renderUiRecordCard,
  renderUiToggleButton,
  type UiPage,
  type UiTone,
} from '@lume-hub/shared-ui';

import type { FrontendTransportMode } from '../app/BrowserTransportFactory.js';
import type { AppRouteDefinition, AppRouter } from '../app/AppRouter.js';
import type { WebAppBootstrap } from '../app/WebAppBootstrap.js';

type PreviewState = 'none' | 'loading' | 'empty' | 'offline' | 'error';
type ScreenState = 'loading' | 'ready' | 'empty' | 'offline' | 'error';

interface AppShellState {
  readonly mode: FrontendTransportMode;
  readonly previewState: PreviewState;
  readonly route: string;
  readonly screenState: ScreenState;
  readonly page: UiPage | null;
  readonly errorMessage: string | null;
  readonly liveEvents: readonly FrontendUiEvent[];
  readonly lastLoadedAt: string | null;
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
              <p class="eyebrow">Wave 13</p>
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
              Aqui queremos validar visual, linguagem, largura total e navegacao principal antes de entrar nos fluxos guiados.
            </p>
            <ul>
              <li>Confirmar que a home ocupa bem o viewport e nao deixa vazio lateral excessivo.</li>
              <li>Ver se a hierarquia visual faz sentido sem explicacao tecnica.</li>
              <li>Ver se o utilizador sabe logo o que fazer a seguir.</li>
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
      case '/groups':
        return this.renderGroupsPage(this.state.page as UiPage<readonly Group[]>);
      case '/whatsapp':
        return this.renderWhatsAppPage(this.state.page as UiPage<WhatsAppWorkspaceSnapshot>);
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

  private renderWhatsAppPage(page: UiPage<WhatsAppWorkspaceSnapshot>): string {
    const snapshot = page.data;

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Canal WhatsApp</p>
          <h2>Estado da ligacao, grupos conhecidos e permissoes humanas num unico sitio.</h2>
          <p>${escapeHtml(page.description)}</p>
          <div class="action-row">
            ${renderUiActionButton({ label: 'Ver grupos', href: '/groups', dataAttributes: { route: '/groups' } })}
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
        </div>
      </section>

      <section class="card-grid">
        ${renderUiMetricCard({ title: 'Grupos autorizados', value: `${snapshot.permissionSummary.authorizedGroups}/${snapshot.permissionSummary.knownGroups}`, tone: 'neutral', description: 'Cobertura atual do assistente nos grupos conhecidos.' })}
        ${renderUiMetricCard({ title: 'Privados autorizados', value: `${snapshot.permissionSummary.authorizedPrivateConversations}/${snapshot.permissionSummary.knownPrivateConversations}`, tone: 'neutral', description: 'Conversas privadas onde o assistente pode responder.' })}
        ${renderUiMetricCard({ title: 'App owners', value: String(snapshot.permissionSummary.appOwners), tone: 'positive', description: 'Pessoas com controlo global da aplicacao.' })}
        ${renderUiMetricCard({ title: 'Mesmo auth do Codex', value: snapshot.host.sameAsCodexCanonical ? 'Sim' : 'Nao', tone: snapshot.host.sameAsCodexCanonical ? 'positive' : 'warning', description: 'Partilha do auth live com o ambiente principal.' })}
      </section>

      <section class="content-grid">
        <article class="surface content-card span-4">
          <div class="card-header">
            <h3>App owners</h3>
          </div>
          <ul>
            ${snapshot.appOwners
              .map(
                (person) =>
                  `<li><strong>${escapeHtml(person.displayName)}</strong> · ${escapeHtml(person.whatsappJids.join(', ') || 'sem JID')}</li>`,
              )
              .join('')}
          </ul>
        </article>
        <article class="surface content-card span-8">
          <div class="card-header">
            <h3>Grupos</h3>
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

    return `
      <section class="surface hero surface--strong">
        <div>
          <p class="eyebrow">Distribuicoes</p>
          <h2>Regras declarativas e campanhas em andamento numa vista mais legivel.</h2>
          <p>${escapeHtml(page.description)}</p>
        </div>
        <div class="hero-panel">
          ${renderUiPanelCard({
            title: 'Atividade',
            badgeLabel: `${snapshot.distributions.length} distribuicoes`,
            badgeTone: 'neutral',
            contentHtml: `<p>${escapeHtml(`${snapshot.rules.length} regras ativas alimentam o plano de distribuicao multi-grupo.`)}</p>`,
          })}
        </div>
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
    const issues = page.data;

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
