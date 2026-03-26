import { BaseModule } from '@lume-hub/kernel';
import { AssistantContextModule } from '@lume-hub/assistant-context';
import { AudienceRoutingModule } from '@lume-hub/audience-routing';
import { CommandPolicyModule } from '@lume-hub/command-policy';
import { InstructionQueueModule } from '@lume-hub/instruction-queue';
import { IntentClassifierModule } from '@lume-hub/intent-classifier';
import { LlmOrchestratorModule } from '@lume-hub/llm-orchestrator';
import { OwnerControlModule } from '@lume-hub/owner-control';

import { AgentRuntime } from '../application/services/AgentRuntime.js';
import type { AgentRuntimeModuleContract } from '../public/contracts/index.js';
import { AgentDecisionService } from '../domain/services/AgentDecisionService.js';
import { ToolCallPolicy } from '../domain/services/ToolCallPolicy.js';
import { ToolRegistry } from '../domain/services/ToolRegistry.js';
import type { AgentRuntimeModuleConfig } from './AgentRuntimeModuleConfig.js';

export class AgentRuntimeModule extends BaseModule implements AgentRuntimeModuleContract {
  readonly moduleName = 'agent-runtime' as const;
  readonly service: AgentRuntime;

  constructor(readonly config: AgentRuntimeModuleConfig = {}) {
    super({
      name: 'agent-runtime',
      version: '0.1.0',
      dependencies: [
        'assistant-context',
        'audience-routing',
        'command-policy',
        'instruction-queue',
        'intent-classifier',
        'llm-orchestrator',
        'owner-control',
      ],
    });

    const assistantContext = config.assistantContext ?? new AssistantContextModule();
    const audienceRouting = config.audienceRouting ?? new AudienceRoutingModule();
    const commandPolicy = config.commandPolicy ?? new CommandPolicyModule();
    const instructionQueue = config.instructionQueue ?? new InstructionQueueModule();
    const intentClassifier = config.intentClassifier ?? new IntentClassifierModule();
    const llmOrchestrator = config.llmOrchestrator ?? new LlmOrchestratorModule();
    const ownerControl = config.ownerControl ?? new OwnerControlModule();

    this.service =
      config.service ??
      new AgentRuntime(
        assistantContext,
        audienceRouting,
        commandPolicy,
        instructionQueue,
        intentClassifier,
        llmOrchestrator,
        ownerControl,
        config.toolRegistry ?? new ToolRegistry(),
        config.toolCallPolicy ?? new ToolCallPolicy(),
        config.decisionService ?? new AgentDecisionService(),
      );
  }

  async executeConversationTurn(input: Parameters<AgentRuntime['executeConversationTurn']>[0]) {
    return this.service.executeConversationTurn(input);
  }

  async executeAssistantTurn(input: Parameters<AgentRuntime['executeAssistantTurn']>[0]) {
    return this.service.executeAssistantTurn(input);
  }

  listTools() {
    return this.service.listTools();
  }
}
