import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';

import type {
  GroupKnowledgeDocument,
  GroupKnowledgeIndexDocument,
  GroupKnowledgeIndexFile,
  GroupKnowledgeIndexDocumentRecord,
} from '../../domain/entities/GroupKnowledge.js';

export class GroupKnowledgeRepository {
  constructor(
    private readonly groupDirectory: Pick<GroupDirectoryModuleContract, 'getGroupKnowledgeWorkspace'>,
  ) {}

  async readIndex(groupJid: string): Promise<GroupKnowledgeIndexDocument> {
    const workspace = await this.groupDirectory.getGroupKnowledgeWorkspace(groupJid);

    let index: GroupKnowledgeIndexFile | null = null;

    try {
      index = JSON.parse(await readFile(workspace.indexPath, 'utf8')) as GroupKnowledgeIndexFile;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return {
          groupJid,
          indexFilePath: workspace.indexPath,
          exists: false,
          documents: [],
        };
      }

      throw error;
    }

    return {
      groupJid,
      indexFilePath: workspace.indexPath,
      exists: true,
      documents: await Promise.all(
        (index.documents ?? []).map(async (record) =>
          this.readDocument(groupJid, workspace.rootPath, sanitiseIndexRecord(record)),
        ),
      ),
    };
  }

  private async readDocument(
    groupJid: string,
    knowledgeRootPath: string,
    record: GroupKnowledgeIndexDocumentRecord,
  ): Promise<GroupKnowledgeDocument> {
    const absoluteFilePath = resolveKnowledgePath(knowledgeRootPath, record.filePath);

    try {
      return {
        groupJid,
        documentId: record.documentId,
        filePath: record.filePath,
        absoluteFilePath,
        title: record.title,
        summary: record.summary ?? null,
        aliases: record.aliases ?? [],
        tags: record.tags ?? [],
        enabled: record.enabled ?? true,
        exists: true,
        content: await readFile(absoluteFilePath, 'utf8'),
      };
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return {
          groupJid,
          documentId: record.documentId,
          filePath: record.filePath,
          absoluteFilePath,
          title: record.title,
          summary: record.summary ?? null,
          aliases: record.aliases ?? [],
          tags: record.tags ?? [],
          enabled: record.enabled ?? true,
          exists: false,
          content: null,
        };
      }

      throw error;
    }
  }
}

function sanitiseIndexRecord(record: GroupKnowledgeIndexDocumentRecord): GroupKnowledgeIndexDocumentRecord {
  return {
    documentId: record.documentId.trim(),
    filePath: sanitiseRelativePath(record.filePath),
    title: record.title.trim(),
    summary: record.summary?.trim() || null,
    aliases: (record.aliases ?? []).map((value) => value.trim()).filter((value) => value.length > 0),
    tags: (record.tags ?? []).map((value) => value.trim()).filter((value) => value.length > 0),
    enabled: record.enabled ?? true,
  };
}

function sanitiseRelativePath(filePath: string): string {
  const normalised = filePath.trim().replace(/\\/g, '/');
  const segments = normalised.split('/');

  if (
    normalised.length === 0 ||
    normalised.startsWith('/') ||
    segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw new Error(`Invalid group knowledge file path '${filePath}'.`);
  }

  return normalised;
}

function resolveKnowledgePath(rootPath: string, filePath: string): string {
  const resolvedRoot = resolve(rootPath);
  const resolvedFilePath = resolve(resolvedRoot, filePath);

  if (resolvedFilePath !== resolvedRoot && !resolvedFilePath.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error(`Knowledge document '${filePath}' escapes group knowledge root.`);
  }

  return resolvedFilePath;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
