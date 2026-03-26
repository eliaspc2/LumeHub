import { BaseModule } from '@lume-hub/kernel';
import type { IntentClassifierModuleConfig } from './IntentClassifierModuleConfig.js';

export class IntentClassifierModule extends BaseModule {
  constructor(readonly config: IntentClassifierModuleConfig = {}) {
    super({
      name: 'intent-classifier',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
