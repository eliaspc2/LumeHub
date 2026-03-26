export interface DashboardUiModuleConfig {
  readonly route: string;
}

export class DashboardUiModule {
  constructor(readonly config: DashboardUiModuleConfig = { route: '/dashboard' }) {}
}
