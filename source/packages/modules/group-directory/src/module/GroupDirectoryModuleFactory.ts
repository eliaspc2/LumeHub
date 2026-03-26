import type { ModuleContext } from '@lume-hub/kernel';
import { GroupDirectoryModule } from './GroupDirectoryModule.js';
import type { GroupDirectoryModuleConfig } from './GroupDirectoryModuleConfig.js';

export class GroupDirectoryModuleFactory {
  create(_context: ModuleContext, config: GroupDirectoryModuleConfig = {}): GroupDirectoryModule {
    return new GroupDirectoryModule(config);
  }
}
