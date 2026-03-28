export type CalendarAccessMode = 'read' | 'read_write';

export interface GroupOwnerAssignment {
  readonly personId: string;
  readonly assignedAt: string;
  readonly assignedBy: string | null;
}

export interface GroupOwnerAssignmentInput {
  readonly personId: string;
  readonly assignedAt?: string;
  readonly assignedBy?: string | null;
}

export interface GroupCalendarAccessPolicy {
  readonly group: CalendarAccessMode;
  readonly groupOwner: CalendarAccessMode;
  readonly appOwner: CalendarAccessMode;
}

export interface Group {
  readonly groupJid: string;
  readonly preferredSubject: string;
  readonly aliases: readonly string[];
  readonly courseId: string | null;
  readonly groupOwners: readonly GroupOwnerAssignment[];
  readonly calendarAccessPolicy: GroupCalendarAccessPolicy;
  readonly lastRefreshedAt: string | null;
}

export interface GroupWorkspaceDescriptor {
  readonly rootPath: string;
  readonly llmRootPath: string;
  readonly llmInstructionsPath: string;
  readonly knowledgeRootPath: string;
  readonly knowledgeIndexPath: string;
  readonly policyPath: string;
  readonly calendarDirectoryPath: string;
}

export type GroupLlmInstructionsSource = 'llm_instructions' | 'missing';

export interface GroupLlmInstructionsDocument {
  readonly primaryFilePath: string;
  readonly resolvedFilePath: string | null;
  readonly exists: boolean;
  readonly source: GroupLlmInstructionsSource;
  readonly content: string | null;
}

export interface GroupLlmInstructionsUpdateInput {
  readonly content: string;
}

export interface GroupPolicyDocument {
  readonly filePath: string;
  readonly exists: boolean;
  readonly value: Record<string, unknown> | null;
}

export interface GroupKnowledgeWorkspaceDescriptor {
  readonly rootPath: string;
  readonly indexPath: string;
}

export interface WhatsAppGroupSnapshot {
  readonly groupJid: string;
  readonly subject: string;
  readonly aliases?: readonly string[];
}

export interface GroupCatalogFile {
  readonly schemaVersion: 1;
  readonly groups: readonly Group[];
}

export const DEFAULT_GROUP_CALENDAR_ACCESS_POLICY: GroupCalendarAccessPolicy = {
  group: 'read',
  groupOwner: 'read_write',
  appOwner: 'read_write',
};
