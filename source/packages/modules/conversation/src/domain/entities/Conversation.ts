import type { AgentAssistantTurnInput, AgentReplyMode, AgentTurnResult } from '@lume-hub/agent-runtime';

export interface IncomingConversationMessage extends AgentAssistantTurnInput {}

export interface GeneratedReply {
  readonly shouldReply: boolean;
  readonly replyText: string | null;
  readonly targetChatType: 'group' | 'private' | null;
  readonly targetChatJid: string | null;
  readonly reason: string | null;
  readonly auditId: string | null;
  readonly agentResult: AgentTurnResult;
}

export interface ConversationAuditRecord {
  readonly auditId: string;
  readonly messageId: string;
  readonly chatJid: string;
  readonly chatType: 'group' | 'private';
  readonly personId: string | null;
  readonly intent: AgentTurnResult['session']['classification']['intent'];
  readonly selectedTools: readonly string[];
  readonly replyMode: AgentReplyMode;
  readonly replyText: string | null;
  readonly targetChatType: 'group' | 'private' | null;
  readonly targetChatJid: string | null;
  readonly memoryUsage: {
    readonly scope: 'none' | 'group';
    readonly groupJid: string | null;
    readonly groupLabel: string | null;
    readonly instructionsSource: 'llm_instructions' | 'legacy_prompt' | 'missing' | null;
    readonly instructionsApplied: boolean;
    readonly knowledgeSnippetCount: number;
    readonly knowledgeDocuments: readonly {
      readonly documentId: string;
      readonly title: string;
      readonly filePath: string;
    }[];
  };
  readonly schedulingInsight: {
    readonly requestedAccessMode: 'read' | 'read_write' | null;
    readonly resolvedGroupJids: readonly string[];
    readonly memoryScope: 'none' | 'group';
    readonly memoryGroupJid: string | null;
    readonly memoryGroupLabel: string | null;
  } | null;
  readonly createdAt: string;
}

export interface ConversationAuditFile {
  readonly schemaVersion: 1;
  readonly entries: readonly ConversationAuditRecord[];
}
