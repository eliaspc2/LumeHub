import type { AgentRuntimeModuleContract } from '@lume-hub/agent-runtime';
import type { AssistantContextModuleContract } from '@lume-hub/assistant-context';
import type { CommandPolicyModuleContract } from '@lume-hub/command-policy';

import type { ConversationService } from '../application/services/ConversationService.js';
import type { ConversationAuditService } from '../application/services/ConversationAuditService.js';
import type { ReplyDeliveryPolicy } from '../domain/services/ReplyDeliveryPolicy.js';
import type { GroupReplyPolicy } from '../domain/services/GroupReplyPolicy.js';
import type { ConversationAuditRepository } from '../infrastructure/persistence/ConversationAuditRepository.js';

export interface ConversationModuleConfig {
  readonly enabled?: boolean;
  readonly dataRootPath?: string;
  readonly auditFilePath?: string;
  readonly agentRuntime?: AgentRuntimeModuleContract;
  readonly assistantContext?: AssistantContextModuleContract;
  readonly commandPolicy?: CommandPolicyModuleContract;
  readonly auditRepository?: ConversationAuditRepository;
  readonly auditService?: ConversationAuditService;
  readonly groupReplyPolicy?: GroupReplyPolicy;
  readonly replyDeliveryPolicy?: ReplyDeliveryPolicy;
  readonly service?: ConversationService;
}
