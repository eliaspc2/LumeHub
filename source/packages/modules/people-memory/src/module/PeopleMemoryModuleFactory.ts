import type { ModuleContext } from '@lume-hub/kernel';
import { PeopleMemoryModule } from './PeopleMemoryModule.js';
import type { PeopleMemoryModuleConfig } from './PeopleMemoryModuleConfig.js';

export class PeopleMemoryModuleFactory {
  create(_context: ModuleContext, config: PeopleMemoryModuleConfig = {}): PeopleMemoryModule {
    return new PeopleMemoryModule(config);
  }
}
