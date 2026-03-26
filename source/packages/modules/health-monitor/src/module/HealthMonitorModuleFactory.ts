import type { ModuleContext } from '@lume-hub/kernel';
import { HealthMonitorModule } from './HealthMonitorModule.js';
import type { HealthMonitorModuleConfig } from './HealthMonitorModuleConfig.js';

export class HealthMonitorModuleFactory {
  create(_context: ModuleContext, config: HealthMonitorModuleConfig = {}): HealthMonitorModule {
    return new HealthMonitorModule(config);
  }
}
