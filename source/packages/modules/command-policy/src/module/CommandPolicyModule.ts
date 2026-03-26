import { BaseModule } from '@lume-hub/kernel';
import { GroupDirectoryModule } from '@lume-hub/group-directory';
import { PeopleMemoryModule } from '@lume-hub/people-memory';
import type { CalendarAccessMode } from '@lume-hub/group-directory';

import { CommandPolicyService } from '../application/services/CommandPolicyService.js';
import type { PolicyActorContext } from '../domain/entities/CommandPolicy.js';
import type { CommandPolicyModuleContract } from '../public/contracts/index.js';
import type { CommandPolicyModuleConfig } from './CommandPolicyModuleConfig.js';

export class CommandPolicyModule extends BaseModule implements CommandPolicyModuleContract {
  readonly moduleName = 'command-policy' as const;
  readonly service: CommandPolicyService;

  constructor(readonly config: CommandPolicyModuleConfig = {}) {
    super({
      name: 'command-policy',
      version: '0.1.0',
      dependencies: ['group-directory', 'people-memory'],
    });

    const groupDirectory = config.groupDirectory ?? new GroupDirectoryModule();
    const peopleMemory = config.peopleMemory ?? new PeopleMemoryModule();

    this.service = config.service ?? new CommandPolicyService(groupDirectory, peopleMemory, config.settings);
  }

  async canUseAssistant(context: PolicyActorContext) {
    return this.service.canUseAssistant(context);
  }

  async canUseScheduling(context: PolicyActorContext, requiredMode?: CalendarAccessMode) {
    return this.service.canUseScheduling(context, requiredMode);
  }

  async canManageCalendar(groupJid: string, personId: string | null, requiredMode: CalendarAccessMode) {
    return this.service.canManageCalendar(groupJid, personId, requiredMode);
  }

  async getCalendarAccessMode(groupJid: string, personId: string | null) {
    return this.service.getCalendarAccessMode(groupJid, personId);
  }

  async canUseOwnerTerminal(personId: string | null) {
    return this.service.canUseOwnerTerminal(personId);
  }

  async canAutoReplyInGroup(context: PolicyActorContext) {
    return this.service.canAutoReplyInGroup(context);
  }
}
