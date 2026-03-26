import { BaseModule } from '@lume-hub/kernel';
import type { WatchdogModuleConfig } from './WatchdogModuleConfig.js';

export class WatchdogModule extends BaseModule {
  constructor(readonly config: WatchdogModuleConfig = {}) {
    super({
      name: 'watchdog',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
