import { BaseModule } from '@lume-hub/kernel';
import type { HealthMonitorModuleConfig } from './HealthMonitorModuleConfig.js';

export class HealthMonitorModule extends BaseModule {
  constructor(readonly config: HealthMonitorModuleConfig = {}) {
    super({
      name: 'health-monitor',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
