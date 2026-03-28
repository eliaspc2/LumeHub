import type {
  Group,
  GroupKnowledgeWorkspaceDescriptor,
  GroupLlmInstructionsDocument,
  GroupLlmInstructionsUpdateInput,
  GroupCalendarAccessPolicy,
  GroupOwnerAssignmentInput,
  GroupOwnerAssignment,
  GroupPolicyDocument,
  GroupPromptDocument,
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
  updateCalendarAccessPolicy(
    groupJid: string,
    update: Partial<GroupCalendarAccessPolicy>,
  ): Promise<GroupCalendarAccessPolicy>;
  getGroupWorkspace(groupJid: string): Promise<GroupWorkspaceDescriptor>;
  getGroupKnowledgeWorkspace(groupJid: string): Promise<GroupKnowledgeWorkspaceDescriptor>;
  getGroupLlmInstructions(groupJid: string): Promise<GroupLlmInstructionsDocument>;
  updateGroupLlmInstructions(groupJid: string, input: GroupLlmInstructionsUpdateInput): Promise<GroupLlmInstructionsDocument>;
  getGroupPrompt(groupJid: string): Promise<GroupPromptDocument>;
  getGroupPolicy(groupJid: string): Promise<GroupPolicyDocument>;
  isGroupOwner(groupJid: string, personId: string): Promise<boolean>;
}
