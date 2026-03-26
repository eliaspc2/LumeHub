import type { ModuleContext } from '@lume-hub/kernel';
import { DeliveryTrackerModule } from './DeliveryTrackerModule.js';
import type { DeliveryTrackerModuleConfig } from './DeliveryTrackerModuleConfig.js';

export class DeliveryTrackerModuleFactory {
  create(_context: ModuleContext, config: DeliveryTrackerModuleConfig = {}): DeliveryTrackerModule {
    return new DeliveryTrackerModule(config);
  }
}
