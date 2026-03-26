import { BaseModule } from '@lume-hub/kernel';
import type { InstructionQueueModuleConfig } from './InstructionQueueModuleConfig.js';

export class InstructionQueueModule extends BaseModule {
  constructor(readonly config: InstructionQueueModuleConfig = {}) {
    super({
      name: 'instruction-queue',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
