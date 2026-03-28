import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  AtomicJsonWriter,
  GroupFileLockManager,
  GroupPathResolver,
} from '@lume-hub/persistence-group-files';
import { z } from 'zod';

import {
  DEFAULT_MEDIA_RETENTION_POLICY,
  MEDIA_LIBRARY_SCHEMA_VERSION,
  type MediaAsset,
  type MediaAssetIngestInput,
  type MediaAssetIngestResult,
  type MediaAssetMetadataFile,
  type MediaAssetRecord,
  type MediaLibraryIndexFile,
  type MediaLibrarySnapshot,
  type MediaRetentionPolicy,
} from '../../domain/entities/MediaLibrary.js';

const mediaRetentionPolicySchema = z.object({
  mode: z.literal('manual'),
  deleteAfterDays: z.null(),
  description: z.string().trim().min(1),
});

const mediaAssetRecordSchema = z.object({
  assetId: z.string().trim().min(1),
  mediaType: z.enum(['video', 'image', 'document', 'audio', 'other']),
  mimeType: z.string().trim().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  fileSize: z.number().int().nonnegative(),
  sourceChatJid: z.string().trim().min(1),
  sourceMessageId: z.string().trim().min(1),
  caption: z.string().trim().min(1).nullable().default(null),
  storedAt: z.string().datetime({ offset: true }),
});

const mediaLibraryIndexFileSchema = z.object({
  schemaVersion: z.literal(MEDIA_LIBRARY_SCHEMA_VERSION),
  retentionPolicy: mediaRetentionPolicySchema.default(DEFAULT_MEDIA_RETENTION_POLICY),
  assets: z.array(mediaAssetRecordSchema).default([]),
});

const mediaAssetMetadataFileSchema = z.object({
  schemaVersion: z.literal(MEDIA_LIBRARY_SCHEMA_VERSION),
  retentionPolicy: mediaRetentionPolicySchema.default(DEFAULT_MEDIA_RETENTION_POLICY),
  asset: mediaAssetRecordSchema,
});

export interface MediaLibraryRepositoryOptions {
  readonly dataRootPath?: string;
  readonly retentionPolicy?: MediaRetentionPolicy;
  readonly pathResolver?: GroupPathResolver;
  readonly fileLockManager?: GroupFileLockManager;
  readonly jsonWriter?: AtomicJsonWriter;
}

export class MediaLibraryRepository {
  private readonly pathResolver: GroupPathResolver;
  private readonly fileLockManager: GroupFileLockManager;
  private readonly jsonWriter: AtomicJsonWriter;
  private readonly retentionPolicy: MediaRetentionPolicy;

  constructor(options: MediaLibraryRepositoryOptions = {}) {
    this.pathResolver = options.pathResolver ?? new GroupPathResolver({ dataRootPath: options.dataRootPath });
    this.fileLockManager = options.fileLockManager ?? new GroupFileLockManager();
    this.jsonWriter = options.jsonWriter ?? new AtomicJsonWriter();
    this.retentionPolicy = options.retentionPolicy ?? DEFAULT_MEDIA_RETENTION_POLICY;
  }

  async readLibrary(): Promise<MediaLibrarySnapshot> {
    const libraryPath = this.pathResolver.resolveRuntimeMediaLibraryPath();
    const assetsRootPath = this.pathResolver.resolveRuntimeMediaAssetsRootPath();
    const parsedIndex = await this.readIndexFile();

    return {
      libraryPath,
      assetsRootPath,
      exists: parsedIndex.exists,
      retentionPolicy: parsedIndex.file.retentionPolicy,
      assets: await Promise.all(
        parsedIndex.file.assets
          .slice()
          .sort(sortMediaAssetRecords)
          .map(async (record) => this.readAssetFromRecord(record, parsedIndex.file.retentionPolicy)),
      ),
    };
  }

  async listAssets(): Promise<readonly MediaAsset[]> {
    return (await this.readLibrary()).assets;
  }

  async getAsset(assetId: string): Promise<MediaAsset | null> {
    const metadataPath = this.pathResolver.resolveRuntimeMediaAssetMetadataPath(assetId);

    try {
      const parsed = mediaAssetMetadataFileSchema.parse(
        JSON.parse(await readFile(metadataPath, 'utf8')),
      ) satisfies MediaAssetMetadataFile;

      return this.buildAsset(parsed.asset, parsed.retentionPolicy, await pathExists(this.pathResolver.resolveRuntimeMediaAssetBinaryPath(assetId)));
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        if (!(error instanceof SyntaxError) && !(error instanceof z.ZodError)) {
          throw error;
        }
      }
    }

    const index = await this.readIndexFile();
    const record = index.file.assets.find((entry) => entry.assetId === assetId) ?? null;

    if (!record) {
      return null;
    }

    return this.readAssetFromRecord(record, index.file.retentionPolicy);
  }

  async readBinary(assetId: string): Promise<Uint8Array> {
    return readFile(this.pathResolver.resolveRuntimeMediaAssetBinaryPath(assetId));
  }

  async ingestAsset(input: MediaAssetIngestInput): Promise<MediaAssetIngestResult> {
    const binary = toBuffer(input.binary);
    const sha256 = createHash('sha256').update(binary).digest('hex');
    const assetId = sha256;
    const normalisedRecord = mediaAssetRecordSchema.parse({
      assetId,
      mediaType: input.mediaType,
      mimeType: input.mimeType.trim(),
      sha256,
      fileSize: binary.byteLength,
      sourceChatJid: input.sourceChatJid.trim(),
      sourceMessageId: input.sourceMessageId.trim(),
      caption: input.caption?.trim() || null,
      storedAt: input.storedAt ?? new Date().toISOString(),
    }) satisfies MediaAssetRecord;
    const libraryPath = this.pathResolver.resolveRuntimeMediaLibraryPath();

    return this.fileLockManager.withLock(libraryPath, async () => {
      const currentIndex = await this.readIndexFile();
      const existingRecord =
        currentIndex.file.assets.find((record) => record.sha256 === normalisedRecord.sha256) ?? null;

      if (existingRecord) {
        return {
          asset: await this.readAssetFromRecord(existingRecord, currentIndex.file.retentionPolicy),
          deduplicated: true,
        };
      }

      const assetRootPath = this.pathResolver.resolveRuntimeMediaAssetRootPath(assetId);
      const binaryPath = this.pathResolver.resolveRuntimeMediaAssetBinaryPath(assetId);
      const metadataPath = this.pathResolver.resolveRuntimeMediaAssetMetadataPath(assetId);

      await mkdir(assetRootPath, { recursive: true });
      await writeBinaryAtomically(binaryPath, binary);
      await this.jsonWriter.write(metadataPath, {
        schemaVersion: MEDIA_LIBRARY_SCHEMA_VERSION,
        retentionPolicy: this.retentionPolicy,
        asset: normalisedRecord,
      } satisfies MediaAssetMetadataFile);

      const nextAssets = [...currentIndex.file.assets, normalisedRecord].sort(sortMediaAssetRecords);
      await this.jsonWriter.write(libraryPath, {
        schemaVersion: MEDIA_LIBRARY_SCHEMA_VERSION,
        retentionPolicy: this.retentionPolicy,
        assets: nextAssets,
      } satisfies MediaLibraryIndexFile);

      return {
        asset: {
          ...normalisedRecord,
          assetRootPath,
          binaryPath,
          metadataPath,
          exists: true,
          retentionPolicy: this.retentionPolicy,
        },
        deduplicated: false,
      };
    });
  }

  private async readIndexFile(): Promise<{
    readonly exists: boolean;
    readonly file: MediaLibraryIndexFile;
  }> {
    const libraryPath = this.pathResolver.resolveRuntimeMediaLibraryPath();

    try {
      const parsed = mediaLibraryIndexFileSchema.parse(JSON.parse(await readFile(libraryPath, 'utf8')));
      return {
        exists: true,
        file: parsed satisfies MediaLibraryIndexFile,
      };
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return {
          exists: false,
          file: {
            schemaVersion: MEDIA_LIBRARY_SCHEMA_VERSION,
            retentionPolicy: this.retentionPolicy,
            assets: [],
          },
        };
      }

      if (error instanceof SyntaxError || error instanceof z.ZodError) {
        throw new Error(`Invalid media library file at '${libraryPath}'.`);
      }

      throw error;
    }
  }

  private async readAssetFromRecord(
    record: MediaAssetRecord,
    retentionPolicy: MediaRetentionPolicy,
  ): Promise<MediaAsset> {
    const exists = await pathExists(this.pathResolver.resolveRuntimeMediaAssetBinaryPath(record.assetId));
    return this.buildAsset(record, retentionPolicy, exists);
  }

  private buildAsset(
    record: MediaAssetRecord,
    retentionPolicy: MediaRetentionPolicy,
    exists: boolean,
  ): MediaAsset {
    return {
      ...record,
      assetRootPath: this.pathResolver.resolveRuntimeMediaAssetRootPath(record.assetId),
      binaryPath: this.pathResolver.resolveRuntimeMediaAssetBinaryPath(record.assetId),
      metadataPath: this.pathResolver.resolveRuntimeMediaAssetMetadataPath(record.assetId),
      exists,
      retentionPolicy,
    };
  }
}

function sortMediaAssetRecords(left: MediaAssetRecord, right: MediaAssetRecord): number {
  return (
    right.storedAt.localeCompare(left.storedAt) ||
    left.assetId.localeCompare(right.assetId)
  );
}

function toBuffer(value: Uint8Array): Buffer {
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

async function writeBinaryAtomically(targetPath: string, value: Uint8Array): Promise<void> {
  const directoryPath = dirname(targetPath);
  const tempPath = join(
    directoryPath,
    `.${Date.now()}-${Math.random().toString(16).slice(2)}.${Math.abs(process.pid)}.tmp`,
  );

  await mkdir(directoryPath, { recursive: true });
  await writeFile(tempPath, value);

  const handle = await open(tempPath, 'r');

  try {
    await handle.sync();
  } finally {
    await handle.close();
  }

  await rename(tempPath, targetPath);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
