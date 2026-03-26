import type { ModuleContext } from '@lume-hub/kernel';
import { InstructionQueueModule } from './InstructionQueueModule.js';
import type { InstructionQueueModuleConfig } from './InstructionQueueModuleConfig.js';

export class InstructionQueueModuleFactory {
  create(_context: ModuleContext, config: InstructionQueueModuleConfig = {}): InstructionQueueModule {
    return new InstructionQueueModule(config);
  }
}
