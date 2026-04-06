export type {
  CalendarAccessQuery,
  CommandPolicySettings,
  PolicyAccessDecision,
  PolicyActorRole,
  PolicyActorContext,
  PolicyChatType,
} from '../../domain/entities/CommandPolicy.js';
export type { CalendarAccessMode } from '@lume-hub/group-directory';

export interface CommandPolicyModuleContract {
  readonly moduleName: 'command-policy';

  canUseAssistant(context: import('../../domain/entities/CommandPolicy.js').PolicyActorContext): Promise<boolean>;
  explainAssistantAccess(
    context: import('../../domain/entities/CommandPolicy.js').PolicyActorContext,
  ): Promise<import('../../domain/entities/CommandPolicy.js').PolicyAccessDecision>;
  canUseScheduling(
    context: import('../../domain/entities/CommandPolicy.js').PolicyActorContext,
    requiredMode?: import('@lume-hub/group-directory').CalendarAccessMode,
  ): Promise<boolean>;
  canManageCalendar(
    groupJid: string,
    personId: string | null,
    requiredMode: import('@lume-hub/group-directory').CalendarAccessMode,
  ): Promise<boolean>;
  getCalendarAccessMode(
    groupJid: string,
    personId: string | null,
  ): Promise<import('@lume-hub/group-directory').CalendarAccessMode>;
  canUseOwnerTerminal(personId: string | null): Promise<boolean>;
  canAutoReplyInGroup(context: import('../../domain/entities/CommandPolicy.js').PolicyActorContext): Promise<boolean>;
  explainAutoReplyInGroup(
    context: import('../../domain/entities/CommandPolicy.js').PolicyActorContext,
  ): Promise<import('../../domain/entities/CommandPolicy.js').PolicyAccessDecision>;
}
