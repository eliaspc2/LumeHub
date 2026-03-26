import { BaseModule } from '@lume-hub/kernel';
import type { AlertsModuleConfig } from './AlertsModuleConfig.js';

export class AlertsModule extends BaseModule {
  constructor(readonly config: AlertsModuleConfig = {}) {
    super({
      name: 'alerts',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
