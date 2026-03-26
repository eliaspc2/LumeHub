export interface AssistantContextModuleContract {
  readonly moduleName: 'assistant-context';

  buildChatContext(
    input: import('../../domain/entities/AssistantContext.js').BuildChatContextInput,
  ): Promise<import('../../domain/entities/AssistantContext.js').AssistantChatContext>;
  buildSchedulingContext(
    input: import('../../domain/entities/AssistantContext.js').BuildSchedulingContextInput,
  ): Promise<import('../../domain/entities/AssistantContext.js').SchedulingContext>;
  recordMessage(
    input: import('../../domain/entities/AssistantContext.js').RecordConversationMessageInput,
  ): Promise<import('../../domain/entities/AssistantContext.js').ConversationHistoryMessage>;
  listChatHistory(
    chatJid: string,
    limit?: number,
  ): Promise<readonly import('../../domain/entities/AssistantContext.js').ConversationHistoryMessage[]>;
}
