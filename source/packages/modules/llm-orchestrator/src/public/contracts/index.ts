export interface LlmOrchestratorModuleContract {
  readonly moduleName: 'llm-orchestrator';

  chat(
    input: import('../../domain/entities/LlmOrchestrator.js').LlmChatInput,
  ): Promise<import('../../domain/entities/LlmOrchestrator.js').LlmChatResult>;
  parseSchedules(
    input: import('../../domain/entities/LlmOrchestrator.js').LlmScheduleParseInput,
  ): Promise<import('../../domain/entities/LlmOrchestrator.js').LlmScheduleParseResult>;
  planWeeklyPrompts(
    input: import('../../domain/entities/LlmOrchestrator.js').WeeklyPromptPlanningInput,
  ): Promise<import('../../domain/entities/LlmOrchestrator.js').WeeklyPromptPlan>;
  listModels(): readonly import('../../domain/entities/LlmOrchestrator.js').LlmModelDescriptor[];
}
