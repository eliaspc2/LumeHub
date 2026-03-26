export interface SettingsCenterUiModuleConfig {
  readonly route: string;
}

export class SettingsCenterUiModule {
  constructor(readonly config: SettingsCenterUiModuleConfig = { route: '/settings-center' }) {}
}
