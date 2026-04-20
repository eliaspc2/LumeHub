export type {
  DistributionPlanEnqueueInput,
  Instruction,
  InstructionAction,
  InstructionActionExecutionResult,
  InstructionActionInput,
  InstructionActionStatus,
  InstructionEnqueueInput,
  InstructionMode,
  ScheduleApplyEnqueueInput,
  ScheduleApplyActionPayload,
  ScheduleApplyDiffEntry,
  ScheduleApplyOperation,
  ReminderDeliveryActionPayload,
  InstructionStatus,
  InstructionTickResult,
} from '../../domain/entities/InstructionQueue.js';

export interface InstructionQueueModuleContract {
  readonly moduleName: 'instruction-queue';

  enqueueInstruction(
    input: import('../../domain/entities/InstructionQueue.js').InstructionEnqueueInput,
  ): Promise<import('../../domain/entities/InstructionQueue.js').Instruction>;
  enqueueDistributionPlan(
    input: import('../../domain/entities/InstructionQueue.js').DistributionPlanEnqueueInput,
  ): Promise<import('../../domain/entities/InstructionQueue.js').Instruction>;
  enqueueScheduleApply(
    input: import('../../domain/entities/InstructionQueue.js').ScheduleApplyEnqueueInput,
  ): Promise<import('../../domain/entities/InstructionQueue.js').Instruction>;
  retryInstruction(instructionId: string): Promise<import('../../domain/entities/InstructionQueue.js').Instruction>;
  tickWorker(now?: Date): Promise<import('../../domain/entities/InstructionQueue.js').InstructionTickResult>;
  listInstructions(): Promise<readonly import('../../domain/entities/InstructionQueue.js').Instruction[]>;
}
