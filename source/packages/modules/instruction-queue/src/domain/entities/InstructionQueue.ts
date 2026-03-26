import type { DistributionPlan } from '@lume-hub/audience-routing';

export type InstructionStatus = 'queued' | 'running' | 'completed' | 'partial_failed' | 'failed';
export type InstructionActionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type InstructionMode = 'dry_run' | 'confirmed';

export interface InstructionActionExecutionResult {
  readonly externalMessageId?: string | null;
  readonly note?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export interface InstructionActionInput {
  readonly type: string;
  readonly dedupeKey?: string | null;
  readonly targetGroupJid?: string | null;
  readonly payload?: Record<string, unknown>;
}

export interface InstructionAction extends InstructionActionInput {
  readonly actionId: string;
  readonly dedupeKey: string | null;
  readonly targetGroupJid: string | null;
  readonly payload: Record<string, unknown>;
  readonly status: InstructionActionStatus;
  readonly attemptCount: number;
  readonly lastError: string | null;
  readonly result: InstructionActionExecutionResult | null;
  readonly lastAttemptAt: string | null;
  readonly completedAt: string | null;
}

export interface InstructionEnqueueInput {
  readonly sourceType: string;
  readonly sourceMessageId?: string | null;
  readonly mode?: InstructionMode;
  readonly metadata?: Record<string, unknown>;
  readonly actions: readonly InstructionActionInput[];
}

export interface Instruction {
  readonly instructionId: string;
  readonly sourceType: string;
  readonly sourceMessageId: string | null;
  readonly mode: InstructionMode;
  readonly status: InstructionStatus;
  readonly metadata: Record<string, unknown>;
  readonly actions: readonly InstructionAction[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InstructionQueueFile {
  readonly schemaVersion: 1;
  readonly instructions: readonly Instruction[];
}

export interface InstructionTickResult {
  readonly recoveredActionIds: readonly string[];
  readonly processedInstructionIds: readonly string[];
  readonly processedActionIds: readonly string[];
  readonly failedActionIds: readonly string[];
}

export interface DistributionActionPayload {
  readonly sourceMessageId: string;
  readonly sourcePersonId: string | null;
  readonly sourceDisplayName: string | null;
  readonly messageText: string;
  readonly targetGroupJid: string;
  readonly targetLabel: string;
  readonly requiresConfirmation: boolean;
}

export interface DistributionPlanEnqueueInput {
  readonly plan: DistributionPlan;
  readonly messageText: string;
  readonly mode: InstructionMode;
}
