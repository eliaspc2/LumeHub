import type { ModuleContext } from '@lume-hub/kernel';
import { OwnerControlModule } from './OwnerControlModule.js';
import type { OwnerControlModuleConfig } from './OwnerControlModuleConfig.js';

export class OwnerControlModuleFactory {
  create(_context: ModuleContext, config: OwnerControlModuleConfig = {}): OwnerControlModule {
    return new OwnerControlModule(config);
  }
}
