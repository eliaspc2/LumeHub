import type {
  Group,
  GroupKnowledgeWorkspaceDescriptor,
  GroupLlmInstructionsDocument,
  GroupLlmInstructionsUpdateInput,
  GroupCalendarAccessPolicy,
  GroupOperationalSettings,
  GroupOperationalSettingsUpdate,
  GroupOwnerAssignmentInput,
  GroupOwnerAssignment,
  GroupPolicyDocument,
  GroupWorkspaceDescriptor,
  WhatsAppGroupSnapshot,
} from '../../domain/entities/Group.js';

export interface GroupDirectoryModuleContract {
  readonly moduleName: 'group-directory';

  listGroups(): Promise<readonly Group[]>;
  findByJid(groupJid: string): Promise<Group | undefined>;
  findBySubject(subject: string): Promise<Group | undefined>;
  findByAlias(alias: string): Promise<Group | undefined>;
  refreshFromWhatsApp(snapshots: readonly WhatsAppGroupSnapshot[], now?: Date): Promise<readonly Group[]>;
  getGroupOwners(groupJid: string): Promise<readonly GroupOwnerAssignment[]>;
  replaceGroupOwners(groupJid: string, owners: readonly GroupOwnerAssignmentInput[]): Promise<readonly GroupOwnerAssignment[]>;
  getCalendarAccessPolicy(groupJid: string): Promise<GroupCalendarAccessPolicy>;
  getOperationalSettings(groupJid: string): Promise<GroupOperationalSettings>;
  updateCalendarAccessPolicy(
    groupJid: string,
    update: Partial<GroupCalendarAccessPolicy>,
  ): Promise<GroupCalendarAccessPolicy>;
  updateOperationalSettings(groupJid: string, update: GroupOperationalSettingsUpdate): Promise<GroupOperationalSettings>;
  getGroupWorkspace(groupJid: string): Promise<GroupWorkspaceDescriptor>;
  getGroupKnowledgeWorkspace(groupJid: string): Promise<GroupKnowledgeWorkspaceDescriptor>;
  getGroupLlmInstructions(groupJid: string): Promise<GroupLlmInstructionsDocument>;
  updateGroupLlmInstructions(groupJid: string, input: GroupLlmInstructionsUpdateInput): Promise<GroupLlmInstructionsDocument>;
  getGroupPolicy(groupJid: string): Promise<GroupPolicyDocument>;
  updateGroupPolicy(
    groupJid: string,
    input: {
      readonly value: Record<string, unknown>;
    },
  ): Promise<GroupPolicyDocument>;
  isGroupOwner(groupJid: string, personId: string): Promise<boolean>;
}
