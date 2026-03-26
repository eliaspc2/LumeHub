export interface QueueConsoleUiModuleConfig {
  readonly route: string;
}

export class QueueConsoleUiModule {
  constructor(readonly config: QueueConsoleUiModuleConfig = { route: '/queue-console' }) {}
}
