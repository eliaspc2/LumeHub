import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';

import type {
  GroupKnowledgeDocumentDeleteResult,
  GroupKnowledgeDocumentUpsertInput,
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

  async upsertDocument(input: GroupKnowledgeDocumentUpsertInput): Promise<GroupKnowledgeDocument> {
    const workspace = await this.groupDirectory.getGroupKnowledgeWorkspace(input.groupJid);
    const currentIndex = await this.readRawIndex(input.groupJid, workspace.indexPath);
    const record = sanitiseIndexRecord({
      documentId: input.documentId,
      filePath: input.filePath,
      title: input.title,
      summary: input.summary ?? null,
      aliases: input.aliases ?? [],
      tags: input.tags ?? [],
      enabled: input.enabled ?? true,
    });
    const nextRecords = currentIndex.documents.filter((candidate) => candidate.documentId !== record.documentId);
    nextRecords.push(record);
    nextRecords.sort((left, right) => left.title.localeCompare(right.title, 'pt-PT'));

    const absoluteFilePath = resolveKnowledgePath(workspace.rootPath, record.filePath);
    await mkdir(resolve(workspace.rootPath), { recursive: true });
    await mkdir(dirname(absoluteFilePath), { recursive: true });
    await writeFile(absoluteFilePath, ensureTrailingNewline(input.content), 'utf8');
    await this.writeIndex(workspace.indexPath, {
      schemaVersion: 1,
      documents: nextRecords,
    });

    return this.readDocument(input.groupJid, workspace.rootPath, record);
  }

  async deleteDocument(groupJid: string, documentId: string): Promise<GroupKnowledgeDocumentDeleteResult> {
    const workspace = await this.groupDirectory.getGroupKnowledgeWorkspace(groupJid);
    const currentIndex = await this.readRawIndex(groupJid, workspace.indexPath);
    const target = currentIndex.documents.find((record) => record.documentId === documentId) ?? null;

    if (!target) {
      return {
        groupJid,
        documentId,
        filePath: null,
        deleted: false,
      };
    }

    const nextRecords = currentIndex.documents.filter((record) => record.documentId !== documentId);
    await this.writeIndex(workspace.indexPath, {
      schemaVersion: 1,
      documents: nextRecords,
    });
    await rm(resolveKnowledgePath(workspace.rootPath, target.filePath), { force: true });

    return {
      groupJid,
      documentId,
      filePath: target.filePath,
      deleted: true,
    };
  }

  private async readRawIndex(groupJid: string, indexPath: string): Promise<GroupKnowledgeIndexFile> {
    try {
      return JSON.parse(await readFile(indexPath, 'utf8')) as GroupKnowledgeIndexFile;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return {
          schemaVersion: 1,
          documents: [],
        };
      }

      throw error;
    }
  }

  private async writeIndex(indexPath: string, index: GroupKnowledgeIndexFile): Promise<void> {
    await mkdir(dirname(indexPath), { recursive: true });
    await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
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

function ensureTrailingNewline(value: string): string {
  const trimmed = value.replace(/\r\n/gu, '\n');
  return trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`;
}
