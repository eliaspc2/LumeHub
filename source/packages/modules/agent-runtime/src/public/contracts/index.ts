export interface AgentRuntimeModuleContract {
  readonly moduleName: 'agent-runtime';

  executeConversationTurn(
    input: import('../../domain/entities/AgentRuntime.js').AgentAssistantTurnInput,
  ): Promise<import('../../domain/entities/AgentRuntime.js').AgentTurnResult>;
  executeAssistantTurn(
    input: import('../../domain/entities/AgentRuntime.js').AgentAssistantTurnInput,
  ): Promise<import('../../domain/entities/AgentRuntime.js').AgentTurnResult>;
  listTools(): readonly import('../../domain/entities/AgentRuntime.js').AgentTool[];
}
