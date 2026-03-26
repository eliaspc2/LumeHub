import { DashboardUiModule } from '@lume-hub/dashboard';
import { SettingsCenterUiModule } from '@lume-hub/settings-center';

export class AppRouter {
  routes(): readonly string[] {
    return [new DashboardUiModule().config.route, new SettingsCenterUiModule().config.route];
  }
}
