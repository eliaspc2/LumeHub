import type { CommandPolicyModuleContract } from '@lume-hub/command-policy';
import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { InstructionQueueModuleContract } from '@lume-hub/instruction-queue';
import type { PeopleMemoryModuleContract } from '@lume-hub/people-memory';

import type { OwnerControlService } from '../application/services/OwnerControlService.js';
import type { CommandSanitizer } from '../domain/services/CommandSanitizer.js';
import type { OwnerScopeAuthorizer } from '../domain/services/OwnerScopeAuthorizer.js';
import type { TerminalReplyFormatter } from '../domain/services/TerminalReplyFormatter.js';
import type { TerminalCommandExecutor } from '../infrastructure/terminal/TerminalCommandExecutor.js';

export interface OwnerControlModuleConfig {
  readonly enabled?: boolean;
  readonly commandPolicy?: Pick<CommandPolicyModuleContract, 'canUseOwnerTerminal' | 'getCalendarAccessMode'>;
  readonly peopleMemory?: Pick<PeopleMemoryModuleContract, 'isAppOwner'>;
  readonly groupDirectory?: Pick<GroupDirectoryModuleContract, 'listGroups' | 'isGroupOwner'>;
  readonly instructionQueue?: Pick<InstructionQueueModuleContract, 'listInstructions' | 'retryInstruction'>;
  readonly commandExecutor?: TerminalCommandExecutor;
  readonly sanitizer?: CommandSanitizer;
  readonly scopeAuthorizer?: OwnerScopeAuthorizer;
  readonly replyFormatter?: TerminalReplyFormatter;
  readonly service?: OwnerControlService;
}
