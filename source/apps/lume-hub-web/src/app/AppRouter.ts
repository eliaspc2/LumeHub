import { AssistantConsoleUiModule } from '@lume-hub/assistant-console';
import { DashboardUiModule } from '@lume-hub/dashboard';
import { DeliveryMonitorUiModule } from '@lume-hub/delivery-monitor';
import type { FrontendApiClient } from '@lume-hub/frontend-api-client';
import { GroupDirectoryConsoleUiModule } from '@lume-hub/group-directory-console';
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

export class AppRouter {
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
    return this.routes().map((route) => ({
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
        description: 'Area semanal preparada para crescer com uma visao de agenda mais visual.',
        legacyRoutes: ['/week-planner'],
        render: async () =>
          {
            const [groups, settings] = await Promise.all([
              this.readQuery('groups', () => this.client.listGroups()),
              this.readQuery('settings', () => this.client.getSettings()),
            ]);

            return this.weekPlanner.render({
              timezone: 'Europe/Lisbon',
              focusWeekLabel: formatCurrentIsoWeek(new Date()),
              groupsKnown: groups.length,
              groups: groups.map((group) => ({
                groupJid: group.groupJid,
                preferredSubject: group.preferredSubject,
                courseId: group.courseId,
                ownerLabels: group.groupOwners.map((owner) => owner.personId),
              })),
              defaultNotificationRuleLabels: settings.adminSettings.ui.defaultNotificationRules.map(
                (rule) => rule.label ?? rule.kind,
              ),
            });
          },
      },
      {
        route: this.assistant.config.route,
        label: this.assistant.config.label,
        description: 'Entrada dedicada ao assistente, com linguagem simples e espaco para contexto.',
        legacyRoutes: ['/assistant-console'],
        render: async () => {
          const settings = await this.readQuery('settings', () => this.client.getSettings());

          return this.assistant.render({
            provider: settings.adminSettings.llm.provider,
            model: settings.adminSettings.llm.model,
            assistantEnabled: settings.adminSettings.commands.assistantEnabled,
            directRepliesEnabled: settings.adminSettings.commands.directRepliesEnabled,
          });
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
        description: 'Monitor de entregas e confirmacoes, reservado para ganhar mais detalhe operacional.',
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
        render: async () => this.groupDirectory.render(await this.readQuery('groups', () => this.client.listGroups())),
      },
      {
        route: this.whatsapp.config.route,
        label: this.whatsapp.config.label,
        description: 'Ligacao do canal, grupos conhecidos, conversas privadas e permissoes efetivas.',
        render: async () =>
          this.whatsapp.render(await this.readQuery('whatsapp-workspace', () => this.client.getWhatsAppWorkspace())),
      },
      {
        route: this.settings.config.route,
        label: this.settings.config.label,
        description: 'Centro de configuracao para defaults, energia, host e auth do Codex.',
        render: async () => this.settings.render(await this.readQuery('settings', () => this.client.getSettings())),
      },
    ];
  }

  async renderRoute(rawPath: string): Promise<UiPage> {
    return this.resolveRoute(rawPath).render();
  }

  private async readQuery<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.queryClient.get<T>(key);

    if (cached !== undefined) {
      return cached;
    }

    return this.queryClient.set(key, await loader());
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

function formatCurrentIsoWeek(value: Date): string {
  const date = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
