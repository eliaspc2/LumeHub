import { randomUUID } from 'node:crypto';

import type { GeneratedReply, IncomingConversationMessage } from '../../domain/entities/Conversation.js';
import { ConversationAuditRepository } from '../../infrastructure/persistence/ConversationAuditRepository.js';

export class ConversationAuditService {
  constructor(private readonly repository: ConversationAuditRepository) {}

  async recordTurn(input: IncomingConversationMessage, reply: GeneratedReply, now = new Date()) {
    return this.repository.appendEntry({
      auditId: `conversation-audit-${randomUUID()}`,
      messageId: input.messageId,
      chatJid: input.chatJid,
      chatType: input.chatType,
      personId: input.personId ?? null,
      intent: reply.agentResult.session.classification.intent,
      selectedTools: reply.agentResult.plan.selectedTools,
      replyMode: reply.agentResult.plan.replyMode,
      replyText: reply.replyText,
      targetChatType: reply.targetChatType,
      targetChatJid: reply.targetChatJid,
      memoryUsage: {
        scope: reply.agentResult.memoryUsage.scope,
        groupJid: reply.agentResult.memoryUsage.groupJid,
        groupLabel: reply.agentResult.memoryUsage.groupLabel,
        instructionsSource: reply.agentResult.memoryUsage.instructionsSource,
        instructionsApplied: reply.agentResult.memoryUsage.instructionsApplied,
        knowledgeSnippetCount: reply.agentResult.memoryUsage.knowledgeSnippetCount,
        knowledgeDocuments: reply.agentResult.memoryUsage.knowledgeDocuments.map((document) => ({
          documentId: document.documentId,
          title: document.title,
          filePath: document.filePath,
        })),
      },
      schedulingInsight: reply.agentResult.schedulingInsight
        ? {
            requestedAccessMode: reply.agentResult.schedulingInsight.requestedAccessMode,
            resolvedGroupJids: reply.agentResult.schedulingInsight.resolvedGroupJids,
            memoryScope: reply.agentResult.schedulingInsight.memoryUsage?.scope ?? 'none',
            memoryGroupJid: reply.agentResult.schedulingInsight.memoryUsage?.groupJid ?? null,
            memoryGroupLabel: reply.agentResult.schedulingInsight.memoryUsage?.groupLabel ?? null,
          }
        : null,
      createdAt: now.toISOString(),
    });
  }
}
