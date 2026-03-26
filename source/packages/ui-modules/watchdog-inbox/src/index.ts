export interface WatchdogInboxUiModuleConfig {
  readonly route: string;
}

export class WatchdogInboxUiModule {
  constructor(readonly config: WatchdogInboxUiModuleConfig = { route: '/watchdog-inbox' }) {}
}
