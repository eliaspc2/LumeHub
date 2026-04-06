import type { CalendarAccessMode, GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { PeopleMemoryModuleContract } from '@lume-hub/people-memory';

import type {
  CommandPolicySettings,
  PolicyAccessDecision,
  PolicyActorContext,
} from '../../domain/entities/CommandPolicy.js';
import { DEFAULT_COMMAND_POLICY_SETTINGS } from '../../domain/entities/CommandPolicy.js';
import { CalendarAccessAuthorizer } from '../../domain/services/CalendarAccessAuthorizer.js';
import { OwnerPolicy } from '../../domain/services/OwnerPolicy.js';
import { SenderAuthorizationPolicy } from '../../domain/services/SenderAuthorizationPolicy.js';

export class CommandPolicyService {
  private readonly ownerPolicy: OwnerPolicy;
  private readonly senderPolicy: SenderAuthorizationPolicy;
  private readonly calendarAccessAuthorizer: CalendarAccessAuthorizer;
  private readonly baseSettings: Partial<CommandPolicySettings>;

  constructor(
    groupDirectory: Pick<
      GroupDirectoryModuleContract,
      'listGroups' | 'isGroupOwner' | 'getCalendarAccessPolicy' | 'getOperationalSettings'
    >,
    peopleMemory: Pick<PeopleMemoryModuleContract, 'isAppOwner'>,
    settings: Partial<CommandPolicySettings> = {},
    private readonly settingsResolver?: () => Promise<Partial<CommandPolicySettings> | undefined> | Partial<CommandPolicySettings> | undefined,
  ) {
    this.baseSettings = settings;
    this.ownerPolicy = new OwnerPolicy(peopleMemory, groupDirectory);
    this.senderPolicy = new SenderAuthorizationPolicy(this.ownerPolicy, groupDirectory);
    this.calendarAccessAuthorizer = new CalendarAccessAuthorizer(groupDirectory, this.ownerPolicy);
  }

  async canUseAssistant(context: PolicyActorContext): Promise<boolean> {
    return this.senderPolicy.canUseAssistant(context, await this.readSettings());
  }

  async explainAssistantAccess(context: PolicyActorContext): Promise<PolicyAccessDecision> {
    return this.senderPolicy.explainAssistantAccess(context, await this.readSettings());
  }

  async canUseScheduling(
    context: PolicyActorContext,
    requiredMode: CalendarAccessMode = 'read_write',
  ): Promise<boolean> {
    const settings = await this.readSettings();

    if (!settings.schedulingEnabled || !context.groupJid) {
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
    return this.senderPolicy.canUseOwnerTerminal(personId, await this.readSettings());
  }

  async canAutoReplyInGroup(context: PolicyActorContext): Promise<boolean> {
    return this.senderPolicy.canAutoReplyInGroup(context, await this.readSettings());
  }

  async explainAutoReplyInGroup(context: PolicyActorContext): Promise<PolicyAccessDecision> {
    return this.senderPolicy.explainAutoReplyInGroup(context, await this.readSettings());
  }

  private async readSettings(): Promise<CommandPolicySettings> {
    const dynamicSettings = this.settingsResolver ? await this.settingsResolver() : undefined;

    return {
      ...DEFAULT_COMMAND_POLICY_SETTINGS,
      ...this.baseSettings,
      ...(dynamicSettings ?? {}),
      authorizedGroupJids: dedupe(
        dynamicSettings?.authorizedGroupJids
          ?? this.baseSettings.authorizedGroupJids
          ?? DEFAULT_COMMAND_POLICY_SETTINGS.authorizedGroupJids,
      ),
      authorizedPrivateJids: dedupe(
        dynamicSettings?.authorizedPrivateJids
          ?? this.baseSettings.authorizedPrivateJids
          ?? DEFAULT_COMMAND_POLICY_SETTINGS.authorizedPrivateJids,
      ),
    };
  }
}

function dedupe(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
