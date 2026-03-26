import { BaseModule } from '@lume-hub/kernel';
import type { DeliveryTrackerModuleConfig } from './DeliveryTrackerModuleConfig.js';

export class DeliveryTrackerModule extends BaseModule {
  constructor(readonly config: DeliveryTrackerModuleConfig = {}) {
    super({
      name: 'delivery-tracker',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
