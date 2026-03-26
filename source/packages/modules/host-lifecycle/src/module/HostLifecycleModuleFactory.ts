import type { ModuleContext } from '@lume-hub/kernel';
import { HostLifecycleModule } from './HostLifecycleModule.js';
import type { HostLifecycleModuleConfig } from './HostLifecycleModuleConfig.js';

export class HostLifecycleModuleFactory {
  create(_context: ModuleContext, config: HostLifecycleModuleConfig = {}): HostLifecycleModule {
    return new HostLifecycleModule(config);
  }
}
