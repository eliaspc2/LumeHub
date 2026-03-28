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
    memoryUsage: {
      scope: entry.memoryUsage.scope,
      groupJid: entry.memoryUsage.groupJid?.trim() || null,
      groupLabel: entry.memoryUsage.groupLabel?.trim() || null,
      instructionsSource: entry.memoryUsage.instructionsSource ?? null,
      instructionsApplied: entry.memoryUsage.instructionsApplied,
      knowledgeSnippetCount: Number.isFinite(entry.memoryUsage.knowledgeSnippetCount)
        ? Math.max(0, Math.trunc(entry.memoryUsage.knowledgeSnippetCount))
        : 0,
      knowledgeDocuments: entry.memoryUsage.knowledgeDocuments.map((document) => ({
        documentId: document.documentId.trim(),
        title: document.title.trim(),
        filePath: document.filePath.trim(),
      })),
    },
    schedulingInsight: entry.schedulingInsight
      ? {
          requestedAccessMode: entry.schedulingInsight.requestedAccessMode,
          resolvedGroupJids: entry.schedulingInsight.resolvedGroupJids.map((groupJid) => groupJid.trim()),
          memoryScope: entry.schedulingInsight.memoryScope,
          memoryGroupJid: entry.schedulingInsight.memoryGroupJid?.trim() || null,
          memoryGroupLabel: entry.schedulingInsight.memoryGroupLabel?.trim() || null,
        }
      : null,
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
