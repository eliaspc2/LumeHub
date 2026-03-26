import { BaseModule } from '@lume-hub/kernel';
import type { PeopleMemoryModuleConfig } from './PeopleMemoryModuleConfig.js';

export class PeopleMemoryModule extends BaseModule {
  constructor(readonly config: PeopleMemoryModuleConfig = {}) {
    super({
      name: 'people-memory',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
