import type { AgentRuntimeModuleContract } from '@lume-hub/agent-runtime';
import type { AssistantContextModuleContract } from '@lume-hub/assistant-context';

import type { GeneratedReply, IncomingConversationMessage } from '../../domain/entities/Conversation.js';
import { GroupReplyPolicy } from '../../domain/services/GroupReplyPolicy.js';
import { ReplyDeliveryPolicy } from '../../domain/services/ReplyDeliveryPolicy.js';
import { ConversationAuditService } from './ConversationAuditService.js';

export class ConversationService {
  constructor(
    private readonly agentRuntime: Pick<
      AgentRuntimeModuleContract,
      'executeConversationTurn'
    >,
    private readonly assistantContext: Pick<AssistantContextModuleContract, 'recordMessage'>,
    private readonly groupReplyPolicy: GroupReplyPolicy,
    private readonly replyDeliveryPolicy: ReplyDeliveryPolicy,
    private readonly auditService: ConversationAuditService,
  ) {}

  async generateReply(input: IncomingConversationMessage): Promise<GeneratedReply> {
    const agentResult = await this.agentRuntime.executeConversationTurn(input);
    const target = await this.groupReplyPolicy.decide(input, agentResult);
    return this.replyDeliveryPolicy.create(agentResult, target);
  }

  async handleIncomingMessage(input: IncomingConversationMessage): Promise<GeneratedReply> {
    await this.assistantContext.recordMessage({
      messageId: input.messageId,
      chatJid: input.chatJid,
      chatType: input.chatType,
      groupJid: input.groupJid,
      personId: input.personId,
      senderDisplayName: input.senderDisplayName,
      role: 'user',
      text: input.text,
    });

    const generatedReply = await this.generateReply(input);

    if (generatedReply.shouldReply && generatedReply.replyText && generatedReply.targetChatJid && generatedReply.targetChatType) {
      await this.assistantContext.recordMessage({
        messageId: `${input.messageId}:assistant`,
        chatJid: generatedReply.targetChatJid,
        chatType: generatedReply.targetChatType,
        groupJid: generatedReply.targetChatType === 'group' ? generatedReply.targetChatJid : null,
        personId: input.personId,
        senderDisplayName: 'LumeHub',
        role: 'assistant',
        text: generatedReply.replyText,
      });
    }

    const auditRecord = await this.auditService.recordTurn(input, generatedReply);

    return {
      ...generatedReply,
      auditId: auditRecord.auditId,
    };
  }
}
