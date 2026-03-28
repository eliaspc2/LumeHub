import { randomUUID } from 'node:crypto';

import type {
  Instruction,
  InstructionAction,
  InstructionActionExecutionResult,
  InstructionEnqueueInput,
  InstructionQueueFile,
  InstructionTickResult,
} from '../../domain/entities/InstructionQueue.js';
import { InstructionActionExecutor } from '../../domain/services/InstructionActionExecutor.js';
import { StaleActionRecoveryService } from '../../domain/services/StaleActionRecoveryService.js';
import { InstructionQueueRepository } from '../../infrastructure/persistence/InstructionQueueRepository.js';

export class InstructionQueueService {
  constructor(
    private readonly repository: InstructionQueueRepository,
    private readonly actionExecutor = new InstructionActionExecutor(),
    private readonly staleActionRecovery = new StaleActionRecoveryService(repository),
  ) {}

  async enqueueInstruction(input: InstructionEnqueueInput, now = new Date()): Promise<Instruction> {
    const current = await this.repository.read();
    const isoNow = now.toISOString();
    const duplicateMap = buildDuplicateMap(current.instructions);
    const instruction: Instruction = {
      instructionId: `instruction-${randomUUID()}`,
      sourceType: input.sourceType.trim(),
      sourceMessageId: input.sourceMessageId?.trim() || null,
      mode: input.mode ?? 'confirmed',
      status: 'queued',
      metadata: input.metadata ?? {},
      actions: input.actions.map((action) => {
        const duplicateOf = action.dedupeKey ? duplicateMap.get(action.dedupeKey) : undefined;
        return duplicateOf
          ? {
              actionId: `instruction-action-${randomUUID()}`,
              type: action.type.trim(),
              dedupeKey: action.dedupeKey?.trim() || null,
              targetGroupJid: action.targetGroupJid?.trim() || null,
              payload: action.payload ?? {},
              status: 'skipped' as const,
              attemptCount: 0,
              lastError: null,
              result: {
                note: `duplicate_of:${duplicateOf.instructionId}:${duplicateOf.actionId}`,
              },
              lastAttemptAt: null,
              completedAt: isoNow,
            }
          : {
              actionId: `instruction-action-${randomUUID()}`,
              type: action.type.trim(),
              dedupeKey: action.dedupeKey?.trim() || null,
              targetGroupJid: action.targetGroupJid?.trim() || null,
              payload: action.payload ?? {},
              status: 'pending' as const,
              attemptCount: 0,
              lastError: null,
              result: null,
              lastAttemptAt: null,
              completedAt: null,
            };
      }),
      createdAt: isoNow,
      updatedAt: isoNow,
    };
    const nextInstruction = {
      ...instruction,
      status: deriveInstructionStatus(instruction.actions),
    };

    await this.repository.save({
      ...current,
      instructions: [...current.instructions, nextInstruction],
    });

    return nextInstruction;
  }

  async listInstructions(): Promise<readonly Instruction[]> {
    return (await this.repository.read()).instructions;
  }

  async retryInstruction(instructionId: string, now = new Date()): Promise<Instruction> {
    const current = await this.repository.read();
    const instruction = current.instructions.find((candidate) => candidate.instructionId === instructionId);

    if (!instruction) {
      throw new Error(`Unknown instruction '${instructionId}'.`);
    }

    const nextActions = instruction.actions.map((action) =>
      action.status === 'failed'
        ? {
            ...action,
            status: 'pending' as const,
            lastError: null,
            result: null,
            completedAt: null,
          }
        : action,
    );
    const nextInstruction: Instruction = {
      ...instruction,
      actions: nextActions,
      status: deriveInstructionStatus(nextActions),
      updatedAt: now.toISOString(),
    };

    await this.repository.save({
      ...current,
      instructions: current.instructions.map((candidate) =>
        candidate.instructionId === instructionId ? nextInstruction : candidate,
      ),
    });

    return nextInstruction;
  }

  async tickWorker(now = new Date()): Promise<InstructionTickResult> {
    const recoveredActionIds = await this.staleActionRecovery.recover(now);
    let current = await this.repository.read();
    const processedInstructionIds: string[] = [];
    const processedActionIds: string[] = [];
    const failedActionIds: string[] = [];
    const isoNow = now.toISOString();

    for (const originalInstruction of current.instructions) {
      if (!originalInstruction.actions.some((action) => action.status === 'pending')) {
        continue;
      }

      processedInstructionIds.push(originalInstruction.instructionId);
      let instruction: Instruction = {
        ...originalInstruction,
        status: 'running',
        updatedAt: isoNow,
      };
      current = replaceInstruction(current, instruction);
      await this.repository.save(current);

      for (const action of instruction.actions) {
        if (action.status !== 'pending') {
          continue;
        }

        const runningAction: InstructionAction = {
          ...action,
          status: 'running',
          attemptCount: action.attemptCount + 1,
          lastAttemptAt: isoNow,
        };
        instruction = replaceAction(instruction, runningAction);
        current = replaceInstruction(current, instruction);
        await this.repository.save(current);

        let finalAction: InstructionAction;

        try {
          const result =
            instruction.mode === 'dry_run'
              ? {
                  note: 'dry-run',
                }
              : await this.actionExecutor.execute(runningAction, instruction);
          finalAction = {
            ...runningAction,
            status: 'completed',
            result: normaliseExecutionResult(result),
            lastError: null,
            completedAt: isoNow,
          };
          processedActionIds.push(finalAction.actionId);
        } catch (error) {
          finalAction = {
            ...runningAction,
            status: 'failed',
            result: null,
            lastError: error instanceof Error ? error.message : String(error),
            completedAt: isoNow,
          };
          failedActionIds.push(finalAction.actionId);
        }

        instruction = {
          ...replaceAction(instruction, finalAction),
          updatedAt: isoNow,
        };
        current = replaceInstruction(current, {
          ...instruction,
          status: deriveInstructionStatus(instruction.actions),
        });
        instruction = current.instructions.find((candidate) => candidate.instructionId === instruction.instructionId) ?? instruction;
        await this.repository.save(current);
      }

      instruction = {
        ...instruction,
        status: deriveInstructionStatus(instruction.actions),
        updatedAt: isoNow,
      };
      current = replaceInstruction(current, instruction);
      await this.repository.save(current);
    }

    return {
      recoveredActionIds,
      processedInstructionIds,
      processedActionIds,
      failedActionIds,
    };
  }
}

function replaceInstruction(file: InstructionQueueFile, nextInstruction: Instruction): InstructionQueueFile {
  return {
    ...file,
    instructions: file.instructions.map((instruction) =>
      instruction.instructionId === nextInstruction.instructionId ? nextInstruction : instruction,
    ),
  };
}

function replaceAction(instruction: Instruction, nextAction: InstructionAction): Instruction {
  return {
    ...instruction,
    actions: instruction.actions.map((action) => (action.actionId === nextAction.actionId ? nextAction : action)),
  };
}

function buildDuplicateMap(
  instructions: readonly Instruction[],
): Map<string, { readonly instructionId: string; readonly actionId: string }> {
  const duplicates = new Map<string, { readonly instructionId: string; readonly actionId: string }>();

    for (const instruction of instructions) {
      if (instruction.mode === 'dry_run') {
        continue;
      }

      for (const action of instruction.actions) {
        if (!action.dedupeKey || action.status === 'failed') {
          continue;
        }

      duplicates.set(action.dedupeKey, {
        instructionId: instruction.instructionId,
        actionId: action.actionId,
      });
    }
  }

  return duplicates;
}

function deriveInstructionStatus(actions: readonly InstructionAction[]): Instruction['status'] {
  if (actions.length === 0) {
    return 'completed';
  }

  if (actions.every((action) => action.status === 'completed' || action.status === 'skipped')) {
    return 'completed';
  }

  if (actions.every((action) => action.status === 'failed')) {
    return 'failed';
  }

  if (actions.some((action) => action.status === 'failed')) {
    return 'partial_failed';
  }

  if (actions.some((action) => action.status === 'running')) {
    return 'running';
  }

  return 'queued';
}

function normaliseExecutionResult(
  result: InstructionActionExecutionResult,
): InstructionActionExecutionResult {
  return {
    externalMessageId: result.externalMessageId ?? null,
    note: result.note ?? null,
    metadata: result.metadata ?? {},
  };
}
