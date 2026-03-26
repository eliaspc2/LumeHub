import type { ModuleContext } from '@lume-hub/kernel';
import { ScheduleEventsModule } from './ScheduleEventsModule.js';
import type { ScheduleEventsModuleConfig } from './ScheduleEventsModuleConfig.js';

export class ScheduleEventsModuleFactory {
  create(_context: ModuleContext, config: ScheduleEventsModuleConfig = {}): ScheduleEventsModule {
    return new ScheduleEventsModule(config);
  }
}
