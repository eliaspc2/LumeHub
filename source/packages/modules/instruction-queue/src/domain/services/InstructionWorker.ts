import type { InstructionTickResult } from '../entities/InstructionQueue.js';
import { InstructionQueueService } from '../../application/services/InstructionQueueService.js';

export class InstructionWorker {
  constructor(private readonly service: InstructionQueueService) {}

  async tick(now = new Date()): Promise<InstructionTickResult> {
    return this.service.tickWorker(now);
  }
}
