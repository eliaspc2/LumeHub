export type CalendarAccessMode = 'read' | 'read_write';

export interface GroupOwnerAssignment {
  readonly personId: string;
  readonly assignedAt: string;
  readonly assignedBy: string | null;
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
  readonly promptPath: string;
  readonly policyPath: string;
  readonly calendarDirectoryPath: string;
}

export interface GroupPromptDocument {
  readonly filePath: string;
  readonly exists: boolean;
  readonly content: string | null;
}

export interface GroupPolicyDocument {
  readonly filePath: string;
  readonly exists: boolean;
  readonly value: Record<string, unknown> | null;
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
