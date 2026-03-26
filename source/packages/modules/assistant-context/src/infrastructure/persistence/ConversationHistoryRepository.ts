import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

import type { ConversationHistoryFile, ConversationHistoryMessage } from '../../domain/entities/AssistantContext.js';

const EMPTY_HISTORY: ConversationHistoryFile = {
  schemaVersion: 1,
  messages: [],
};

export interface ConversationHistoryRepositoryConfig {
  readonly dataRootPath?: string;
  readonly historyFilePath?: string;
}

export class ConversationHistoryRepository {
  constructor(
    private readonly config: ConversationHistoryRepositoryConfig = {},
    private readonly writer = new AtomicJsonWriter(),
  ) {}

  resolveHistoryFilePath(): string {
    return this.config.historyFilePath ?? join(this.config.dataRootPath ?? 'data', 'runtime', 'conversation-history.json');
  }

  async read(): Promise<ConversationHistoryFile> {
    try {
      return normaliseHistory(JSON.parse(await readFile(this.resolveHistoryFilePath(), 'utf8')) as ConversationHistoryFile);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return EMPTY_HISTORY;
      }

      throw error;
    }
  }

  async listMessages(chatJid?: string): Promise<readonly ConversationHistoryMessage[]> {
    const history = await this.read();
    return chatJid ? history.messages.filter((message) => message.chatJid === chatJid) : history.messages;
  }

  async appendMessage(message: ConversationHistoryMessage): Promise<ConversationHistoryMessage> {
    const current = await this.read();
    const nextMessage = normaliseMessage(message);
    await this.writer.write(this.resolveHistoryFilePath(), {
      schemaVersion: 1,
      messages: [...current.messages.filter((entry) => entry.messageId !== nextMessage.messageId), nextMessage].sort(
        (left, right) => left.createdAt.localeCompare(right.createdAt) || left.messageId.localeCompare(right.messageId),
      ),
    });
    return nextMessage;
  }
}

function normaliseHistory(history: ConversationHistoryFile): ConversationHistoryFile {
  return {
    schemaVersion: 1,
    messages: history.messages.map(normaliseMessage),
  };
}

function normaliseMessage(message: ConversationHistoryMessage): ConversationHistoryMessage {
  return {
    messageId: message.messageId.trim(),
    chatJid: message.chatJid.trim(),
    chatType: message.chatType,
    groupJid: message.groupJid?.trim() || null,
    personId: message.personId?.trim() || null,
    senderDisplayName: message.senderDisplayName?.trim() || null,
    role: message.role,
    text: message.text.trim(),
    createdAt: message.createdAt,
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
