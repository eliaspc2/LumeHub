import { BaseModule } from '@lume-hub/kernel';
import type { AdminConfigModuleConfig } from './AdminConfigModuleConfig.js';

export class AdminConfigModule extends BaseModule {
  constructor(readonly config: AdminConfigModuleConfig = {}) {
    super({
      name: 'admin-config',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
