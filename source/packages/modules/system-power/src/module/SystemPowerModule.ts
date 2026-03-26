import { BaseModule } from '@lume-hub/kernel';
import type { SystemPowerModuleConfig } from './SystemPowerModuleConfig.js';

export class SystemPowerModule extends BaseModule {
  constructor(readonly config: SystemPowerModuleConfig = {}) {
    super({
      name: 'system-power',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
