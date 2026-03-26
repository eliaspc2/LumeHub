import type { Instruction, InstructionAction, InstructionQueueFile } from '../entities/InstructionQueue.js';
import { InstructionQueueRepository } from '../../infrastructure/persistence/InstructionQueueRepository.js';

export class StaleActionRecoveryService {
  constructor(private readonly repository: InstructionQueueRepository) {}

  async recover(now = new Date()): Promise<readonly string[]> {
    const current = await this.repository.read();
    const recoveredActionIds: string[] = [];
    const nextInstructions = current.instructions.map((instruction) => {
      let changed = false;
      const nextActions = instruction.actions.map((action) => {
        if (action.status !== 'running') {
          return action;
        }

        changed = true;
        recoveredActionIds.push(action.actionId);

        return {
          ...action,
          status: 'pending' as const,
          lastError: action.lastError ?? 'Recovered stale running action.',
        };
      });

      if (!changed && instruction.status !== 'running') {
        return instruction;
      }

      return {
        ...instruction,
        status: nextActions.some((action) => action.status === 'pending') ? ('queued' as const) : instruction.status,
        actions: nextActions,
        updatedAt: now.toISOString(),
      };
    });

    if (recoveredActionIds.length > 0) {
      await this.repository.save({
        ...current,
        instructions: nextInstructions,
      });
    }

    return recoveredActionIds;
  }
}
