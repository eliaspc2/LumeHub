import { BaseModule } from '@lume-hub/kernel';
import type { HostLifecycleModuleConfig } from './HostLifecycleModuleConfig.js';

export class HostLifecycleModule extends BaseModule {
  constructor(readonly config: HostLifecycleModuleConfig = {}) {
    super({
      name: 'host-lifecycle',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
