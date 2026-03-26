import type { ModuleContext } from '@lume-hub/kernel';
import { WatchdogModule } from './WatchdogModule.js';
import type { WatchdogModuleConfig } from './WatchdogModuleConfig.js';

export class WatchdogModuleFactory {
  create(_context: ModuleContext, config: WatchdogModuleConfig = {}): WatchdogModule {
    return new WatchdogModule(config);
  }
}
