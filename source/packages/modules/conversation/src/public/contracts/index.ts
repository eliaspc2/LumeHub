export interface ConversationModuleContract {
  readonly moduleName: 'conversation';

  handleIncomingMessage(
    input: import('../../domain/entities/Conversation.js').IncomingConversationMessage,
  ): Promise<import('../../domain/entities/Conversation.js').GeneratedReply>;
  generateReply(
    input: import('../../domain/entities/Conversation.js').IncomingConversationMessage,
  ): Promise<import('../../domain/entities/Conversation.js').GeneratedReply>;
}
