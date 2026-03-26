export interface AssistantConsoleUiModuleConfig {
  readonly route: string;
}

export class AssistantConsoleUiModule {
  constructor(readonly config: AssistantConsoleUiModuleConfig = { route: '/assistant-console' }) {}
}
