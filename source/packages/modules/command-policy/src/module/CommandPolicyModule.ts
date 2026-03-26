import { BaseModule } from '@lume-hub/kernel';
import type { CommandPolicyModuleConfig } from './CommandPolicyModuleConfig.js';

export class CommandPolicyModule extends BaseModule {
  constructor(readonly config: CommandPolicyModuleConfig = {}) {
    super({
      name: 'command-policy',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
