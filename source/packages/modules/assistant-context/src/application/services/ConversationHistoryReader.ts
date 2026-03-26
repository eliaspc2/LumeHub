import type { ConversationHistoryMessage } from '../../domain/entities/AssistantContext.js';
import { ConversationHistoryRepository } from '../../infrastructure/persistence/ConversationHistoryRepository.js';

export class ConversationHistoryReader {
  constructor(private readonly repository: ConversationHistoryRepository) {}

  async listRecentMessages(chatJid: string, limit = 10): Promise<readonly ConversationHistoryMessage[]> {
    const messages = await this.repository.listMessages(chatJid);
    return messages.slice(-Math.max(limit, 1));
  }
}
