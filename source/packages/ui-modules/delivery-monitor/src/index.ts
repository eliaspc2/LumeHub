export interface DeliveryMonitorUiModuleConfig {
  readonly route: string;
}

export class DeliveryMonitorUiModule {
  constructor(readonly config: DeliveryMonitorUiModuleConfig = { route: '/delivery-monitor' }) {}
}
