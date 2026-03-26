import { BaseModule } from '@lume-hub/kernel';
import { CommandPolicyModule } from '@lume-hub/command-policy';
import { GroupDirectoryModule } from '@lume-hub/group-directory';
import { InstructionQueueModule } from '@lume-hub/instruction-queue';
import { PeopleMemoryModule } from '@lume-hub/people-memory';

import { OwnerControlService } from '../application/services/OwnerControlService.js';
import type { OwnerCommandContext } from '../domain/entities/OwnerControl.js';
import type { OwnerControlModuleContract } from '../public/contracts/index.js';
import { CommandSanitizer } from '../domain/services/CommandSanitizer.js';
import { TerminalReplyFormatter } from '../domain/services/TerminalReplyFormatter.js';
import { TerminalCommandExecutor } from '../infrastructure/terminal/TerminalCommandExecutor.js';
import type { OwnerControlModuleConfig } from './OwnerControlModuleConfig.js';

export class OwnerControlModule extends BaseModule implements OwnerControlModuleContract {
  readonly moduleName = 'owner-control' as const;
  readonly service: OwnerControlService;

  constructor(readonly config: OwnerControlModuleConfig = {}) {
    super({
      name: 'owner-control',
      version: '0.1.0',
      dependencies: ['command-policy', 'instruction-queue', 'group-directory', 'people-memory'],
    });

    const commandPolicy = config.commandPolicy ?? new CommandPolicyModule();
    const peopleMemory = config.peopleMemory ?? new PeopleMemoryModule();
    const groupDirectory = config.groupDirectory ?? new GroupDirectoryModule();
    const instructionQueue = config.instructionQueue ?? new InstructionQueueModule();

    this.service =
      config.service ??
      new OwnerControlService(
        commandPolicy,
        peopleMemory,
        groupDirectory,
        instructionQueue,
        config.commandExecutor ?? new TerminalCommandExecutor(),
        config.sanitizer ?? new CommandSanitizer(),
        config.replyFormatter ?? new TerminalReplyFormatter(),
      );
  }

  detectOwnerCommand(messageText: string) {
    return this.service.detectOwnerCommand(messageText);
  }

  async resolveOwnerScope(personId: string | null) {
    return this.service.resolveOwnerScope(personId);
  }

  async executeOwnerCommand(context: OwnerCommandContext) {
    return this.service.executeOwnerCommand(context);
  }
}
