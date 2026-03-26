import { BaseModule } from '@lume-hub/kernel';
import type { AutomationsModuleConfig } from './AutomationsModuleConfig.js';

export class AutomationsModule extends BaseModule {
  constructor(readonly config: AutomationsModuleConfig = {}) {
    super({
      name: 'automations',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
