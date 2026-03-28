export type MediaType = 'video' | 'image' | 'document' | 'audio' | 'other';

export interface MediaRetentionPolicy {
  readonly mode: 'manual';
  readonly deleteAfterDays: null;
  readonly description: string;
}

export interface MediaAssetRecord {
  readonly assetId: string;
  readonly mediaType: MediaType;
  readonly mimeType: string;
  readonly sha256: string;
  readonly fileSize: number;
  readonly sourceChatJid: string;
  readonly sourceMessageId: string;
  readonly caption: string | null;
  readonly storedAt: string;
}

export interface MediaAssetMetadataFile {
  readonly schemaVersion: 1;
  readonly retentionPolicy: MediaRetentionPolicy;
  readonly asset: MediaAssetRecord;
}

export interface MediaLibraryIndexFile {
  readonly schemaVersion: 1;
  readonly retentionPolicy: MediaRetentionPolicy;
  readonly assets: readonly MediaAssetRecord[];
}

export interface MediaAsset extends MediaAssetRecord {
  readonly assetRootPath: string;
  readonly binaryPath: string;
  readonly metadataPath: string;
  readonly exists: boolean;
  readonly retentionPolicy: MediaRetentionPolicy;
}

export interface MediaLibrarySnapshot {
  readonly libraryPath: string;
  readonly assetsRootPath: string;
  readonly exists: boolean;
  readonly retentionPolicy: MediaRetentionPolicy;
  readonly assets: readonly MediaAsset[];
}

export interface MediaAssetIngestInput {
  readonly mediaType: MediaType;
  readonly mimeType: string;
  readonly binary: Uint8Array;
  readonly sourceChatJid: string;
  readonly sourceMessageId: string;
  readonly caption?: string | null;
  readonly storedAt?: string;
}

export interface MediaAssetIngestResult {
  readonly asset: MediaAsset;
  readonly deduplicated: boolean;
}

export const MEDIA_LIBRARY_SCHEMA_VERSION = 1 as const;

export const DEFAULT_MEDIA_RETENTION_POLICY: MediaRetentionPolicy = {
  mode: 'manual',
  deleteAfterDays: null,
  description:
    'Media recebida fica guardada ate limpeza manual numa ronda futura. Nao existe expiracao automatica nesta fase.',
};
