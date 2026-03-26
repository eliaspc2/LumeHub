import type { CalendarAccessMode, GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { PeopleMemoryModuleContract } from '@lume-hub/people-memory';

import type { CommandPolicySettings, PolicyActorContext } from '../../domain/entities/CommandPolicy.js';
import { DEFAULT_COMMAND_POLICY_SETTINGS } from '../../domain/entities/CommandPolicy.js';
import { CalendarAccessAuthorizer } from '../../domain/services/CalendarAccessAuthorizer.js';
import { OwnerPolicy } from '../../domain/services/OwnerPolicy.js';
import { SenderAuthorizationPolicy } from '../../domain/services/SenderAuthorizationPolicy.js';

export class CommandPolicyService {
  readonly settings: CommandPolicySettings;
  private readonly ownerPolicy: OwnerPolicy;
  private readonly senderPolicy: SenderAuthorizationPolicy;
  private readonly calendarAccessAuthorizer: CalendarAccessAuthorizer;

  constructor(
    groupDirectory: Pick<
      GroupDirectoryModuleContract,
      'listGroups' | 'isGroupOwner' | 'getCalendarAccessPolicy'
    >,
    peopleMemory: Pick<PeopleMemoryModuleContract, 'isAppOwner'>,
    settings: Partial<CommandPolicySettings> = {},
  ) {
    this.settings = {
      ...DEFAULT_COMMAND_POLICY_SETTINGS,
      ...settings,
      authorizedGroupJids: dedupe(settings.authorizedGroupJids ?? DEFAULT_COMMAND_POLICY_SETTINGS.authorizedGroupJids),
      authorizedPrivateJids: dedupe(
        settings.authorizedPrivateJids ?? DEFAULT_COMMAND_POLICY_SETTINGS.authorizedPrivateJids,
      ),
    };
    this.ownerPolicy = new OwnerPolicy(peopleMemory, groupDirectory);
    this.senderPolicy = new SenderAuthorizationPolicy(this.ownerPolicy);
    this.calendarAccessAuthorizer = new CalendarAccessAuthorizer(groupDirectory, this.ownerPolicy);
  }

  async canUseAssistant(context: PolicyActorContext): Promise<boolean> {
    return this.senderPolicy.canUseAssistant(context, this.settings);
  }

  async canUseScheduling(
    context: PolicyActorContext,
    requiredMode: CalendarAccessMode = 'read_write',
  ): Promise<boolean> {
    if (!this.settings.schedulingEnabled || !context.groupJid) {
      return false;
    }

    return this.canManageCalendar(context.groupJid, context.personId, requiredMode);
  }

  async canManageCalendar(
    groupJid: string,
    personId: string | null,
    requiredMode: CalendarAccessMode,
  ): Promise<boolean> {
    return this.calendarAccessAuthorizer.canManageCalendar(groupJid, personId, requiredMode);
  }

  async getCalendarAccessMode(groupJid: string, personId: string | null): Promise<CalendarAccessMode> {
    return this.calendarAccessAuthorizer.getCalendarAccessMode(groupJid, personId);
  }

  async canUseOwnerTerminal(personId: string | null): Promise<boolean> {
    return this.senderPolicy.canUseOwnerTerminal(personId, this.settings);
  }

  async canAutoReplyInGroup(context: PolicyActorContext): Promise<boolean> {
    return this.senderPolicy.canAutoReplyInGroup(context, this.settings);
  }
}

function dedupe(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
