import type { ModuleContext } from '@lume-hub/kernel';
import { CommandPolicyModule } from './CommandPolicyModule.js';
import type { CommandPolicyModuleConfig } from './CommandPolicyModuleConfig.js';

export class CommandPolicyModuleFactory {
  create(_context: ModuleContext, config: CommandPolicyModuleConfig = {}): CommandPolicyModule {
    return new CommandPolicyModule(config);
  }
}
