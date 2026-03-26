import type {
  Instruction,
  InstructionAction,
  InstructionActionExecutionResult,
} from '../entities/InstructionQueue.js';

export type InstructionActionExecutorHandler = (
  action: InstructionAction,
  instruction: Instruction,
) => Promise<InstructionActionExecutionResult>;

export class InstructionActionExecutor {
  constructor(
    private readonly handler: InstructionActionExecutorHandler = async (action) => ({
      note: `noop:${action.type}`,
    }),
  ) {}

  async execute(action: InstructionAction, instruction: Instruction): Promise<InstructionActionExecutionResult> {
    return this.handler(action, instruction);
  }
}
