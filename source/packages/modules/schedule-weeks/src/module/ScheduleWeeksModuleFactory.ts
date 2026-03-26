import type { ModuleContext } from '@lume-hub/kernel';

import { ScheduleWeeksModule } from './ScheduleWeeksModule.js';
import type { ScheduleWeeksModuleConfig } from './ScheduleWeeksModuleConfig.js';

export class ScheduleWeeksModuleFactory {
  create(_context: ModuleContext, config: ScheduleWeeksModuleConfig = {}): ScheduleWeeksModule {
    return new ScheduleWeeksModule(config);
  }
}
