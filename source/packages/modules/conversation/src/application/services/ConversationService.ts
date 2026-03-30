import type { AgentRuntimeModuleContract } from '@lume-hub/agent-runtime';

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
    const generatedReply = await this.generateReply(input);

    const auditRecord = await this.auditService.recordTurn(input, generatedReply);

    return {
      ...generatedReply,
      auditId: auditRecord.auditId,
    };
  }
}
