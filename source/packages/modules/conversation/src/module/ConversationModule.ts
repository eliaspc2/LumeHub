import { BaseModule } from '@lume-hub/kernel';
import { AgentRuntimeModule } from '@lume-hub/agent-runtime';
import { AssistantContextModule } from '@lume-hub/assistant-context';
import { CommandPolicyModule } from '@lume-hub/command-policy';

import { ConversationAuditService } from '../application/services/ConversationAuditService.js';
import { ConversationService } from '../application/services/ConversationService.js';
import { GroupReplyPolicy } from '../domain/services/GroupReplyPolicy.js';
import { ReplyDeliveryPolicy } from '../domain/services/ReplyDeliveryPolicy.js';
import { ConversationAuditRepository } from '../infrastructure/persistence/ConversationAuditRepository.js';
import type { ConversationModuleContract } from '../public/contracts/index.js';
import type { ConversationModuleConfig } from './ConversationModuleConfig.js';

export class ConversationModule extends BaseModule implements ConversationModuleContract {
  readonly moduleName = 'conversation' as const;
  readonly service: ConversationService;

  constructor(readonly config: ConversationModuleConfig = {}) {
    super({
      name: 'conversation',
      version: '0.1.0',
      dependencies: ['agent-runtime', 'assistant-context', 'command-policy'],
    });

    const agentRuntime = config.agentRuntime ?? new AgentRuntimeModule();
    config.assistantContext ?? new AssistantContextModule({
      dataRootPath: config.dataRootPath,
    });
    const commandPolicy = config.commandPolicy ?? new CommandPolicyModule();
    const auditRepository =
      config.auditRepository ??
      new ConversationAuditRepository({
        dataRootPath: config.dataRootPath,
        auditFilePath: config.auditFilePath,
      });
    const auditService = config.auditService ?? new ConversationAuditService(auditRepository);
    const groupReplyPolicy = config.groupReplyPolicy ?? new GroupReplyPolicy(commandPolicy);
    const replyDeliveryPolicy = config.replyDeliveryPolicy ?? new ReplyDeliveryPolicy();

    this.service =
      config.service ??
      new ConversationService(
        agentRuntime,
        groupReplyPolicy,
        replyDeliveryPolicy,
        auditService,
      );
  }

  async handleIncomingMessage(input: Parameters<ConversationService['handleIncomingMessage']>[0]) {
    return this.service.handleIncomingMessage(input);
  }

  async generateReply(input: Parameters<ConversationService['generateReply']>[0]) {
    return this.service.generateReply(input);
  }
}
