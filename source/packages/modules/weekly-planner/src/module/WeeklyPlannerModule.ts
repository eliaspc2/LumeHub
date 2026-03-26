import { BaseModule } from '@lume-hub/kernel';
import type { WeeklyPlannerModuleConfig } from './WeeklyPlannerModuleConfig.js';

export class WeeklyPlannerModule extends BaseModule {
  constructor(readonly config: WeeklyPlannerModuleConfig = {}) {
    super({
      name: 'weekly-planner',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
