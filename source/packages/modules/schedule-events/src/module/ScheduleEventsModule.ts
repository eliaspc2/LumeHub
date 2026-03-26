import { BaseModule } from '@lume-hub/kernel';
import type { ScheduleEventsModuleConfig } from './ScheduleEventsModuleConfig.js';

export class ScheduleEventsModule extends BaseModule {
  constructor(readonly config: ScheduleEventsModuleConfig = {}) {
    super({
      name: 'schedule-events',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
