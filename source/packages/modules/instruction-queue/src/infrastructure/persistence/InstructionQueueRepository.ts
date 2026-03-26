import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

import type { Instruction, InstructionAction, InstructionQueueFile } from '../../domain/entities/InstructionQueue.js';

const EMPTY_INSTRUCTION_QUEUE_FILE: InstructionQueueFile = {
  schemaVersion: 1,
  instructions: [],
};

export interface InstructionQueueRepositoryConfig {
  readonly dataRootPath?: string;
  readonly queueFilePath?: string;
}

export class InstructionQueueRepository {
  constructor(
    private readonly config: InstructionQueueRepositoryConfig = {},
    private readonly writer = new AtomicJsonWriter(),
  ) {}

  resolveQueueFilePath(): string {
    return this.config.queueFilePath ?? join(this.config.dataRootPath ?? 'data', 'runtime', 'instruction-queue.json');
  }

  async read(): Promise<InstructionQueueFile> {
    try {
      return normaliseFile(JSON.parse(await readFile(this.resolveQueueFilePath(), 'utf8')) as InstructionQueueFile);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return EMPTY_INSTRUCTION_QUEUE_FILE;
      }

      throw error;
    }
  }

  async save(value: InstructionQueueFile): Promise<InstructionQueueFile> {
    const nextValue = normaliseFile(value);
    await this.writer.write(this.resolveQueueFilePath(), nextValue);
    return nextValue;
  }
}

function normaliseFile(file: InstructionQueueFile): InstructionQueueFile {
  return {
    schemaVersion: 1,
    instructions: file.instructions.map(normaliseInstruction),
  };
}

function normaliseInstruction(instruction: Instruction): Instruction {
  return {
    instructionId: instruction.instructionId.trim(),
    sourceType: instruction.sourceType.trim(),
    sourceMessageId: instruction.sourceMessageId?.trim() || null,
    mode: instruction.mode,
    status: instruction.status,
    metadata: instruction.metadata ?? {},
    actions: instruction.actions.map(normaliseAction),
    createdAt: instruction.createdAt,
    updatedAt: instruction.updatedAt,
  };
}

function normaliseAction(action: InstructionAction): InstructionAction {
  return {
    actionId: action.actionId.trim(),
    type: action.type.trim(),
    dedupeKey: action.dedupeKey?.trim() || null,
    targetGroupJid: action.targetGroupJid?.trim() || null,
    payload: action.payload ?? {},
    status: action.status,
    attemptCount: action.attemptCount ?? 0,
    lastError: action.lastError ?? null,
    result: action.result ?? null,
    lastAttemptAt: action.lastAttemptAt ?? null,
    completedAt: action.completedAt ?? null,
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
