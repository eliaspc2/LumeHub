import { BaseModule } from '@lume-hub/kernel';
import type { ScheduleWeeksModuleConfig } from './ScheduleWeeksModuleConfig.js';

export class ScheduleWeeksModule extends BaseModule {
  constructor(readonly config: ScheduleWeeksModuleConfig = {}) {
    super({
      name: 'schedule-weeks',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
