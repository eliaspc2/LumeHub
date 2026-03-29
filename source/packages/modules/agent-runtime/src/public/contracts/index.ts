export interface AgentRuntimeModuleContract {
  readonly moduleName: 'agent-runtime';

  executeConversationTurn(
    input: import('../../domain/entities/AgentRuntime.js').AgentAssistantTurnInput,
  ): Promise<import('../../domain/entities/AgentRuntime.js').AgentTurnResult>;
  executeAssistantTurn(
    input: import('../../domain/entities/AgentRuntime.js').AgentAssistantTurnInput,
  ): Promise<import('../../domain/entities/AgentRuntime.js').AgentTurnResult>;
  previewScheduleApply(
    input: import('../../domain/entities/AgentRuntime.js').AgentScheduleActionInput,
  ): Promise<import('../../domain/entities/AgentRuntime.js').AgentScheduleApplyPreview>;
  applyScheduleAction(
    input: import('../../domain/entities/AgentRuntime.js').AgentScheduleApplyInput,
  ): Promise<import('../../domain/entities/AgentRuntime.js').AgentScheduleApplyResult>;
  listTools(): readonly import('../../domain/entities/AgentRuntime.js').AgentTool[];
}
