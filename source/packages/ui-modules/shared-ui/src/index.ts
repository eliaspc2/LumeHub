export interface SharedUiUiModuleConfig {
  readonly route: string;
}

export class SharedUiUiModule {
  constructor(readonly config: SharedUiUiModuleConfig = { route: '/shared-ui' }) {}
}
