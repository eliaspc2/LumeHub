import type { CalendarAccessMode, GroupMemberTagPolicy } from '@lume-hub/group-directory';

export type PolicyChatType = 'group' | 'private';

export interface CommandPolicySettings {
  readonly assistantEnabled: boolean;
  readonly schedulingEnabled: boolean;
  readonly ownerTerminalEnabled: boolean;
  readonly autoReplyEnabled: boolean;
  readonly directRepliesEnabled: boolean;
  readonly allowPrivateAssistant: boolean;
  readonly authorizedGroupJids: readonly string[];
  readonly authorizedPrivateJids: readonly string[];
}

export interface PolicyActorContext {
  readonly personId: string | null;
  readonly groupJid?: string | null;
  readonly chatType?: PolicyChatType;
  readonly chatJid?: string | null;
  readonly wasTagged?: boolean;
  readonly isReplyToBot?: boolean;
}

export interface CalendarAccessQuery {
  readonly personId: string | null;
  readonly groupJid: string;
  readonly requiredMode: CalendarAccessMode;
}

export type PolicyActorRole = 'app_owner' | 'group_owner' | 'member' | 'unknown';

export interface PolicyAccessDecision {
  readonly allowed: boolean;
  readonly actorRole: PolicyActorRole;
  readonly chatType: PolicyChatType;
  readonly groupJid: string | null;
  readonly interactionPolicy: GroupMemberTagPolicy | null;
  readonly reasonCode: string;
  readonly summary: string;
}

export const DEFAULT_COMMAND_POLICY_SETTINGS: CommandPolicySettings = {
  assistantEnabled: true,
  schedulingEnabled: true,
  ownerTerminalEnabled: true,
  autoReplyEnabled: true,
  directRepliesEnabled: false,
  allowPrivateAssistant: true,
  authorizedGroupJids: [],
  authorizedPrivateJids: [],
};
