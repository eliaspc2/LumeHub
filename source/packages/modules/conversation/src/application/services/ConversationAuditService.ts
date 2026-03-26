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
      createdAt: now.toISOString(),
    });
  }
}
