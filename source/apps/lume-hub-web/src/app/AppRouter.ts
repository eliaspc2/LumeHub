import { DashboardUiModule } from '@lume-hub/dashboard';
import type { FrontendApiClient } from '@lume-hub/frontend-api-client';
import { GroupDirectoryConsoleUiModule } from '@lume-hub/group-directory-console';
import { QueueConsoleUiModule } from '@lume-hub/queue-console';
import { SettingsCenterUiModule } from '@lume-hub/settings-center';
import type { NavigationItem, UiPage } from '@lume-hub/shared-ui';
import { WatchdogInboxUiModule } from '@lume-hub/watchdog-inbox';

import type { QueryClient } from './QueryClientFactory.js';

export interface AppRouteDefinition {
  readonly route: string;
  readonly label: string;
  render(): Promise<UiPage>;
}

export class AppRouter {
  private readonly dashboard = new DashboardUiModule();
  private readonly groupDirectory = new GroupDirectoryConsoleUiModule();
  private readonly routing = new QueueConsoleUiModule();
  private readonly watchdog = new WatchdogInboxUiModule();
  private readonly settings = new SettingsCenterUiModule();

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

  routes(): readonly AppRouteDefinition[] {
    return [
      {
        route: this.dashboard.config.route,
        label: this.dashboard.config.label,
        render: async () => this.dashboard.render(await this.readQuery('dashboard', () => this.client.getDashboard())),
      },
      {
        route: this.groupDirectory.config.route,
        label: this.groupDirectory.config.label,
        render: async () => this.groupDirectory.render(await this.readQuery('groups', () => this.client.listGroups())),
      },
      {
        route: this.routing.config.route,
        label: this.routing.config.label,
        render: async () =>
          this.routing.render({
            rules: await this.readQuery('routing-rules', () => this.client.listRoutingRules()),
            distributions: await this.readQuery('routing-distributions', () => this.client.listDistributions()),
          }),
      },
      {
        route: this.watchdog.config.route,
        label: this.watchdog.config.label,
        render: async () =>
          this.watchdog.render(await this.readQuery('watchdog-issues', () => this.client.getWatchdogIssues())),
      },
      {
        route: this.settings.config.route,
        label: this.settings.config.label,
        render: async () => this.settings.render(await this.readQuery('settings', () => this.client.getSettings())),
      },
    ];
  }

  async renderPages(): Promise<readonly UiPage[]> {
    const pages: UiPage[] = [];

    for (const route of this.routes()) {
      try {
        pages.push(await route.render());
      } catch (error) {
        pages.push({
          route: route.route,
          title: route.label,
          description: 'Falha a carregar pagina.',
          sections: [
            {
              title: 'Erro',
              lines: [error instanceof Error ? error.message : String(error)],
            },
          ],
          data: null,
        });
      }
    }

    return pages;
  }

  private async readQuery<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.queryClient.get<T>(key);

    if (cached !== undefined) {
      return cached;
    }

    return this.queryClient.set(key, await loader());
  }
}
