import { BaseModule } from '@lume-hub/kernel';
import type { GroupDirectoryModuleConfig } from './GroupDirectoryModuleConfig.js';

export class GroupDirectoryModule extends BaseModule {
  constructor(readonly config: GroupDirectoryModuleConfig = {}) {
    super({
      name: 'group-directory',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
