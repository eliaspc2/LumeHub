import type { ModuleContext } from '@lume-hub/kernel';
import { WeeklyPlannerModule } from './WeeklyPlannerModule.js';
import type { WeeklyPlannerModuleConfig } from './WeeklyPlannerModuleConfig.js';

export class WeeklyPlannerModuleFactory {
  create(_context: ModuleContext, config: WeeklyPlannerModuleConfig = {}): WeeklyPlannerModule {
    return new WeeklyPlannerModule(config);
  }
}
