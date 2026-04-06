import type { AssistantContextModuleContract } from '@lume-hub/assistant-context';
import type { AudienceRoutingModuleContract } from '@lume-hub/audience-routing';
import type { CommandPolicyModuleContract } from '@lume-hub/command-policy';
import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { InstructionQueueModuleContract } from '@lume-hub/instruction-queue';
import type { IntentClassifierModuleContract } from '@lume-hub/intent-classifier';
import type { LlmOrchestratorModuleContract } from '@lume-hub/llm-orchestrator';
import type { OwnerControlModuleContract } from '@lume-hub/owner-control';
import type { WeeklyPlannerModuleContract } from '@lume-hub/weekly-planner';

import type { AgentRuntime } from '../application/services/AgentRuntime.js';
import type { AgentDecisionService } from '../domain/services/AgentDecisionService.js';
import type { ToolCallPolicy } from '../domain/services/ToolCallPolicy.js';
import type { ToolRegistry } from '../domain/services/ToolRegistry.js';

export interface AgentRuntimeModuleConfig {
  readonly enabled?: boolean;
  readonly assistantContext?: AssistantContextModuleContract;
  readonly audienceRouting?: AudienceRoutingModuleContract;
  readonly commandPolicy?: CommandPolicyModuleContract;
  readonly groupDirectory?: GroupDirectoryModuleContract;
  readonly instructionQueue?: InstructionQueueModuleContract;
  readonly intentClassifier?: IntentClassifierModuleContract;
  readonly llmOrchestrator?: LlmOrchestratorModuleContract;
  readonly ownerControl?: OwnerControlModuleContract;
  readonly weeklyPlanner?: WeeklyPlannerModuleContract;
  readonly toolRegistry?: ToolRegistry;
  readonly toolCallPolicy?: ToolCallPolicy;
  readonly decisionService?: AgentDecisionService;
  readonly service?: AgentRuntime;
}
