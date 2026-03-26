import type { AgentTurnResult } from '@lume-hub/agent-runtime';

import type { GeneratedReply } from '../entities/Conversation.js';
import type { ReplyTargetDecision } from './GroupReplyPolicy.js';

export class ReplyDeliveryPolicy {
  create(agentResult: AgentTurnResult, target: ReplyTargetDecision): GeneratedReply {
    return {
      shouldReply: target.shouldReply,
      replyText: target.shouldReply ? agentResult.replyText : null,
      targetChatType: target.targetChatType,
      targetChatJid: target.targetChatJid,
      reason: target.reason,
      auditId: null,
      agentResult,
    };
  }
}
