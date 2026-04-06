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
  const memoryUsage = normaliseMemoryUsage(
    (entry as ConversationAuditRecord & { readonly memoryUsage?: ConversationAuditRecord['memoryUsage'] }).memoryUsage,
  );
  const schedulingInsight = normaliseSchedulingInsight(
    (entry as ConversationAuditRecord & { readonly schedulingInsight?: ConversationAuditRecord['schedulingInsight'] }).schedulingInsight,
  );
  const permissionInsight = normalisePermissionInsight(
    (entry as ConversationAuditRecord & { readonly permissionInsight?: ConversationAuditRecord['permissionInsight'] }).permissionInsight,
  );

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
    memoryUsage,
    schedulingInsight,
    permissionInsight,
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function normaliseMemoryUsage(
  memoryUsage: ConversationAuditRecord['memoryUsage'] | undefined,
): ConversationAuditRecord['memoryUsage'] {
  if (!memoryUsage) {
    return {
      scope: 'none',
      groupJid: null,
      groupLabel: null,
      instructionsSource: null,
      instructionsApplied: false,
      knowledgeSnippetCount: 0,
      knowledgeDocuments: [],
    };
  }

  return {
    scope: memoryUsage.scope,
    groupJid: memoryUsage.groupJid?.trim() || null,
    groupLabel: memoryUsage.groupLabel?.trim() || null,
    instructionsSource: memoryUsage.instructionsSource ?? null,
    instructionsApplied: memoryUsage.instructionsApplied,
    knowledgeSnippetCount: Number.isFinite(memoryUsage.knowledgeSnippetCount)
      ? Math.max(0, Math.trunc(memoryUsage.knowledgeSnippetCount))
      : 0,
    knowledgeDocuments: (memoryUsage.knowledgeDocuments ?? []).map((document) => ({
      documentId: document.documentId.trim(),
      title: document.title.trim(),
      filePath: document.filePath.trim(),
    })),
  };
}

function normaliseSchedulingInsight(
  schedulingInsight: ConversationAuditRecord['schedulingInsight'] | undefined,
): ConversationAuditRecord['schedulingInsight'] {
  if (!schedulingInsight) {
    return null;
  }

  return {
    requestedAccessMode: schedulingInsight.requestedAccessMode,
    resolvedGroupJids: (schedulingInsight.resolvedGroupJids ?? []).map((groupJid) => groupJid.trim()),
    memoryScope: schedulingInsight.memoryScope,
    memoryGroupJid: schedulingInsight.memoryGroupJid?.trim() || null,
    memoryGroupLabel: schedulingInsight.memoryGroupLabel?.trim() || null,
  };
}

function normalisePermissionInsight(
  permissionInsight: ConversationAuditRecord['permissionInsight'] | undefined,
): ConversationAuditRecord['permissionInsight'] {
  if (!permissionInsight) {
    return null;
  }

  return {
    allowed: permissionInsight.allowed,
    actorRole: permissionInsight.actorRole,
    chatType: permissionInsight.chatType,
    groupJid: permissionInsight.groupJid?.trim() || null,
    interactionPolicy: permissionInsight.interactionPolicy ?? null,
    reasonCode: permissionInsight.reasonCode.trim(),
    summary: permissionInsight.summary.trim(),
  };
}
