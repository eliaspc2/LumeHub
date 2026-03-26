import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

import type { ConversationAuditFile, ConversationAuditRecord } from '../../domain/entities/Conversation.js';

const EMPTY_AUDIT: ConversationAuditFile = {
  schemaVersion: 1,
  entries: [],
};

export interface ConversationAuditRepositoryConfig {
  readonly dataRootPath?: string;
  readonly auditFilePath?: string;
}

export class ConversationAuditRepository {
  constructor(
    private readonly config: ConversationAuditRepositoryConfig = {},
    private readonly writer = new AtomicJsonWriter(),
  ) {}

  resolveAuditFilePath(): string {
    return this.config.auditFilePath ?? join(this.config.dataRootPath ?? 'data', 'runtime', 'conversation-audit.json');
  }

  async read(): Promise<ConversationAuditFile> {
    try {
      return normaliseAudit(JSON.parse(await readFile(this.resolveAuditFilePath(), 'utf8')) as ConversationAuditFile);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return EMPTY_AUDIT;
      }

      throw error;
    }
  }

  async appendEntry(entry: ConversationAuditRecord): Promise<ConversationAuditRecord> {
    const current = await this.read();
    const nextEntry = normaliseEntry(entry);
    await this.writer.write(this.resolveAuditFilePath(), {
      schemaVersion: 1,
      entries: [...current.entries, nextEntry],
    });
    return nextEntry;
  }
}

function normaliseAudit(audit: ConversationAuditFile): ConversationAuditFile {
  return {
    schemaVersion: 1,
    entries: audit.entries.map(normaliseEntry),
  };
}

function normaliseEntry(entry: ConversationAuditRecord): ConversationAuditRecord {
  return {
    ...entry,
    auditId: entry.auditId.trim(),
    messageId: entry.messageId.trim(),
    chatJid: entry.chatJid.trim(),
    personId: entry.personId?.trim() || null,
    selectedTools: entry.selectedTools.map((tool) => tool.trim()),
    replyText: entry.replyText?.trim() || null,
    targetChatType: entry.targetChatType,
    targetChatJid: entry.targetChatJid?.trim() || null,
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
