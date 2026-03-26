import type { CommandPolicyModuleContract } from '@lume-hub/command-policy';
import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { Instruction, InstructionQueueModuleContract } from '@lume-hub/instruction-queue';
import type { PeopleMemoryModuleContract } from '@lume-hub/people-memory';

import type {
  OwnerCommand,
  OwnerCommandContext,
  OwnerCommandExecutionResult,
  OwnerScopeResolution,
} from '../../domain/entities/OwnerControl.js';
import { CommandSanitizer } from '../../domain/services/CommandSanitizer.js';
import { OwnerScopeAuthorizer } from '../../domain/services/OwnerScopeAuthorizer.js';
import { TerminalReplyFormatter } from '../../domain/services/TerminalReplyFormatter.js';
import { TerminalCommandExecutor } from '../../infrastructure/terminal/TerminalCommandExecutor.js';

export class OwnerControlService {
  private readonly scopeAuthorizer: OwnerScopeAuthorizer;

  constructor(
    private readonly commandPolicy: Pick<
      CommandPolicyModuleContract,
      'canUseOwnerTerminal' | 'getCalendarAccessMode'
    >,
    peopleMemory: Pick<PeopleMemoryModuleContract, 'isAppOwner'>,
    groupDirectory: Pick<GroupDirectoryModuleContract, 'listGroups' | 'isGroupOwner'>,
    private readonly instructionQueue: Pick<InstructionQueueModuleContract, 'listInstructions' | 'retryInstruction'>,
    private readonly commandExecutor = new TerminalCommandExecutor(),
    private readonly sanitizer = new CommandSanitizer(),
    private readonly replyFormatter = new TerminalReplyFormatter(),
  ) {
    this.scopeAuthorizer = new OwnerScopeAuthorizer(peopleMemory, groupDirectory);
  }

  detectOwnerCommand(messageText: string): OwnerCommand | null {
    const trimmed = messageText.trim();

    if (trimmed.startsWith('!term ')) {
      return {
        kind: 'terminal',
        rawText: messageText,
        argument: trimmed.slice('!term '.length).trim() || null,
      };
    }

    if (trimmed === '!queue' || trimmed === '!queue list') {
      return {
        kind: 'queue_list',
        rawText: messageText,
        argument: null,
      };
    }

    if (trimmed.startsWith('!queue retry ')) {
      return {
        kind: 'queue_retry',
        rawText: messageText,
        argument: trimmed.slice('!queue retry '.length).trim() || null,
      };
    }

    if (trimmed.startsWith('!calendar access ')) {
      return {
        kind: 'calendar_access',
        rawText: messageText,
        argument: trimmed.slice('!calendar access '.length).trim() || null,
      };
    }

    return null;
  }

  async resolveOwnerScope(personId: string | null): Promise<OwnerScopeResolution> {
    return this.scopeAuthorizer.resolve(personId);
  }

  async executeOwnerCommand(context: OwnerCommandContext): Promise<OwnerCommandExecutionResult> {
    const command = this.detectOwnerCommand(context.messageText);
    const scope = await this.resolveOwnerScope(context.personId);

    if (!command) {
      return deny(scope, null, 'not_owner_command');
    }

    if (scope.scope === 'none') {
      return deny(scope, command, 'sender_not_owner');
    }

    switch (command.kind) {
      case 'terminal':
        if (!(await this.commandPolicy.canUseOwnerTerminal(context.personId))) {
          return deny(scope, command, 'owner_terminal_requires_app_owner');
        }

        try {
          const terminalCommand = this.sanitizer.sanitize(command.argument ?? '');
          const terminalResult = await this.commandExecutor.execute(terminalCommand, {
            timeoutMs: context.timeoutMs,
          });
          const formattedReply = this.replyFormatter.format(terminalResult);

          return {
            accepted: true,
            scope,
            command,
            output: formattedReply.output,
            truncated: formattedReply.truncated,
            exitCode: terminalResult.exitCode,
            reason: null,
          };
        } catch (error) {
          return deny(scope, command, error instanceof Error ? error.message : String(error));
        }

      case 'queue_list': {
        const visibleInstructions = filterInstructions(await this.instructionQueue.listInstructions(), scope);
        const formattedReply = this.replyFormatter.formatText(JSON.stringify(visibleInstructions, null, 2));

        return {
          accepted: true,
          scope,
          command,
          output: formattedReply.output,
          truncated: formattedReply.truncated,
          exitCode: null,
          reason: null,
          visibleInstructions,
        };
      }

      case 'queue_retry': {
        const instructionId = command.argument?.trim();

        if (!instructionId) {
          return deny(scope, command, 'missing_instruction_id');
        }

        const instructions = await this.instructionQueue.listInstructions();
        const instruction = instructions.find((candidate) => candidate.instructionId === instructionId);

        if (!instruction) {
          return deny(scope, command, 'unknown_instruction');
        }

        if (!instructionIsVisible(instruction, scope)) {
          return deny(scope, command, 'instruction_out_of_scope');
        }

        const retriedInstruction = await this.instructionQueue.retryInstruction(instructionId);
        const formattedReply = this.replyFormatter.formatText(
          `Retried ${retriedInstruction.instructionId} with ${retriedInstruction.actions.filter((action) => action.status === 'pending').length} pending actions.`,
        );

        return {
          accepted: true,
          scope,
          command,
          output: formattedReply.output,
          truncated: formattedReply.truncated,
          exitCode: null,
          reason: null,
          visibleInstructions: [filterInstructionForScope(retriedInstruction, scope)].filter(Boolean) as readonly Instruction[],
        };
      }

      case 'calendar_access': {
        const targetGroupJid = command.argument?.trim() || context.groupJid?.trim() || null;

        if (!targetGroupJid) {
          return deny(scope, command, 'missing_group_scope');
        }

        if (scope.scope !== 'app_owner' && !scope.allowedGroupJids.includes(targetGroupJid)) {
          return deny(scope, command, 'calendar_scope_out_of_bounds');
        }

        const calendarAccessMode = await this.commandPolicy.getCalendarAccessMode(targetGroupJid, context.personId);
        const formattedReply = this.replyFormatter.formatText(`calendar access: ${calendarAccessMode}`);

        return {
          accepted: true,
          scope,
          command,
          output: formattedReply.output,
          truncated: formattedReply.truncated,
          exitCode: null,
          reason: null,
          calendarAccessMode,
        };
      }
    }
  }
}

function deny(
  scope: OwnerScopeResolution,
  command: OwnerCommand | null,
  reason: string,
): OwnerCommandExecutionResult {
  return {
    accepted: false,
    scope,
    command,
    output: reason,
    truncated: false,
    exitCode: null,
    reason,
  };
}

function filterInstructions(
  instructions: readonly Instruction[],
  scope: OwnerScopeResolution,
): readonly Instruction[] {
  if (scope.scope === 'app_owner') {
    return instructions;
  }

  return instructions
    .map((instruction) => filterInstructionForScope(instruction, scope))
    .filter((instruction): instruction is Instruction => instruction !== null);
}

function filterInstructionForScope(
  instruction: Instruction,
  scope: OwnerScopeResolution,
): Instruction | null {
  if (scope.scope === 'app_owner') {
    return instruction;
  }

  const visibleActions = instruction.actions.filter(
    (action) => action.targetGroupJid && scope.allowedGroupJids.includes(action.targetGroupJid),
  );

  if (visibleActions.length === 0) {
    return null;
  }

  return {
    ...instruction,
    actions: visibleActions,
  };
}

function instructionIsVisible(instruction: Instruction, scope: OwnerScopeResolution): boolean {
  if (scope.scope === 'app_owner') {
    return true;
  }

  return instruction.actions.every(
    (action) => action.targetGroupJid && scope.allowedGroupJids.includes(action.targetGroupJid),
  );
}
