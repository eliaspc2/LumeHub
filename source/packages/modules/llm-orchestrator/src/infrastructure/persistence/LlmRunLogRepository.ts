import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

import type { LlmRunLogEntry, LlmRunLogFile } from '../../domain/entities/LlmOrchestrator.js';

const EMPTY_RUN_LOG: LlmRunLogFile = {
  schemaVersion: 1,
  entries: [],
};

export interface LlmRunLogRepositoryConfig {
  readonly dataRootPath?: string;
  readonly runLogFilePath?: string;
}

export class LlmRunLogRepository {
  constructor(
    private readonly config: LlmRunLogRepositoryConfig = {},
    private readonly writer = new AtomicJsonWriter(),
  ) {}

  resolveRunLogFilePath(): string {
    return this.config.runLogFilePath ?? join(this.config.dataRootPath ?? 'data', 'runtime', 'llm-run-log.json');
  }

  async read(): Promise<LlmRunLogFile> {
    try {
      return normaliseLog(JSON.parse(await readFile(this.resolveRunLogFilePath(), 'utf8')) as LlmRunLogFile);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return EMPTY_RUN_LOG;
      }

      throw error;
    }
  }

  async appendEntry(entry: LlmRunLogEntry): Promise<LlmRunLogEntry> {
    const current = await this.read();
    const nextEntry = normaliseEntry(entry);
    await this.writer.write(this.resolveRunLogFilePath(), {
      schemaVersion: 1,
      entries: [...current.entries, nextEntry],
    });
    return nextEntry;
  }
}

function normaliseLog(log: LlmRunLogFile): LlmRunLogFile {
  return {
    schemaVersion: 1,
    entries: log.entries.map(normaliseEntry),
  };
}

function normaliseEntry(entry: LlmRunLogEntry): LlmRunLogEntry {
  return {
    runId: entry.runId.trim(),
    operation: entry.operation,
    providerId: entry.providerId.trim(),
    modelId: entry.modelId.trim(),
    inputSummary: entry.inputSummary.trim(),
    outputSummary: entry.outputSummary.trim(),
    memoryScope: entry.memoryScope
      ? {
          scope: entry.memoryScope.scope,
          groupJid: entry.memoryScope.groupJid?.trim() || null,
          groupLabel: entry.memoryScope.groupLabel?.trim() || null,
          instructionsSource: entry.memoryScope.instructionsSource ?? null,
          instructionsApplied: entry.memoryScope.instructionsApplied,
          knowledgeSnippetCount: Number.isFinite(entry.memoryScope.knowledgeSnippetCount)
            ? Math.max(0, Math.trunc(entry.memoryScope.knowledgeSnippetCount))
            : 0,
          knowledgeDocuments: entry.memoryScope.knowledgeDocuments.map((document) => ({
            documentId: document.documentId.trim(),
            title: document.title.trim(),
            filePath: document.filePath.trim(),
            score:
              typeof document.score === 'number' && Number.isFinite(document.score)
                ? Number(document.score.toFixed(3))
                : undefined,
            matchedTerms: document.matchedTerms?.map((term) => term.trim()).filter(Boolean),
          })),
        }
      : null,
    createdAt: entry.createdAt,
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
