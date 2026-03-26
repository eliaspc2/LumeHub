import type { CalendarAccessMode, Group } from '@lume-hub/group-directory';
import type { PersonNote } from '@lume-hub/people-memory';

export type AssistantChatType = 'group' | 'private';
export type AssistantMessageRole = 'user' | 'assistant' | 'system';
export type AssistantReferenceKind = 'group' | 'topic';

export interface ConversationHistoryMessage {
  readonly messageId: string;
  readonly chatJid: string;
  readonly chatType: AssistantChatType;
  readonly groupJid: string | null;
  readonly personId: string | null;
  readonly senderDisplayName: string | null;
  readonly role: AssistantMessageRole;
  readonly text: string;
  readonly createdAt: string;
}

export interface ConversationHistoryFile {
  readonly schemaVersion: 1;
  readonly messages: readonly ConversationHistoryMessage[];
}

export interface AssistantContextReference {
  readonly kind: AssistantReferenceKind;
  readonly label: string;
  readonly groupJid: string | null;
  readonly sourceMessageId: string | null;
}

export interface AssistantContextMessageExcerpt extends ConversationHistoryMessage {
  readonly relevanceScore?: number;
}

export interface BuildChatContextInput {
  readonly chatJid: string;
  readonly chatType: AssistantChatType;
  readonly text: string;
  readonly personId?: string | null;
  readonly groupJid?: string | null;
  readonly senderDisplayName?: string | null;
  readonly recentHistoryLimit?: number;
  readonly relevantHistoryLimit?: number;
}

export interface RecordConversationMessageInput {
  readonly messageId: string;
  readonly chatJid: string;
  readonly chatType: AssistantChatType;
  readonly groupJid?: string | null;
  readonly personId?: string | null;
  readonly senderDisplayName?: string | null;
  readonly role: AssistantMessageRole;
  readonly text: string;
}

export interface AssistantChatContext {
  readonly chatJid: string;
  readonly chatType: AssistantChatType;
  readonly currentText: string;
  readonly personId: string | null;
  readonly senderDisplayName: string | null;
  readonly groupJid: string | null;
  readonly group: Pick<Group, 'groupJid' | 'preferredSubject' | 'aliases' | 'courseId'> | null;
  readonly recentMessages: readonly AssistantContextMessageExcerpt[];
  readonly relevantMessages: readonly AssistantContextMessageExcerpt[];
  readonly activeReference: AssistantContextReference | null;
  readonly personNotes: readonly PersonNote[];
  readonly groupPrompt: string | null;
  readonly groupPolicy: Record<string, unknown> | null;
  readonly generatedAt: string;
}

export interface BuildSchedulingContextInput extends BuildChatContextInput {
  readonly requestedAccessMode?: CalendarAccessMode | null;
}

export interface SchedulingContext {
  readonly chatContext: AssistantChatContext;
  readonly requestedAccessMode: CalendarAccessMode | null;
  readonly resolvedGroupJids: readonly string[];
}
