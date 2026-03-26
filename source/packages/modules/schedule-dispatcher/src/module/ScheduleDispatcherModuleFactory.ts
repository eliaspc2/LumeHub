import type { ModuleContext } from '@lume-hub/kernel';

import { ScheduleDispatcherModule } from './ScheduleDispatcherModule.js';
import type { ScheduleDispatcherModuleConfig } from './ScheduleDispatcherModuleConfig.js';

export class ScheduleDispatcherModuleFactory {
  create(_context: ModuleContext, config: ScheduleDispatcherModuleConfig = {}): ScheduleDispatcherModule {
    return new ScheduleDispatcherModule(config);
  }
}
