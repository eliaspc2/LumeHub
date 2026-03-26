import { BaseModule } from '@lume-hub/kernel';
import type { OwnerControlModuleConfig } from './OwnerControlModuleConfig.js';

export class OwnerControlModule extends BaseModule {
  constructor(readonly config: OwnerControlModuleConfig = {}) {
    super({
      name: 'owner-control',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
