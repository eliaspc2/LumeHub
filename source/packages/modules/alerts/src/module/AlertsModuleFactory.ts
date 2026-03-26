import type { ModuleContext } from '@lume-hub/kernel';
import { AlertsModule } from './AlertsModule.js';
import type { AlertsModuleConfig } from './AlertsModuleConfig.js';

export class AlertsModuleFactory {
  create(_context: ModuleContext, config: AlertsModuleConfig = {}): AlertsModule {
    return new AlertsModule(config);
  }
}
