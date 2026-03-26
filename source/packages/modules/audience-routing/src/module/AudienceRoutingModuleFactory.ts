import type { ModuleContext } from '@lume-hub/kernel';

import { AudienceRoutingModule } from './AudienceRoutingModule.js';
import type { AudienceRoutingModuleConfig } from './AudienceRoutingModuleConfig.js';

export class AudienceRoutingModuleFactory {
  create(_context: ModuleContext, config: AudienceRoutingModuleConfig = {}): AudienceRoutingModule {
    return new AudienceRoutingModule(config);
  }
}
