export interface MediaLibraryModuleContract {
  readonly moduleName: 'media-library';

  getLibrary(): Promise<import('../../domain/entities/MediaLibrary.js').MediaLibrarySnapshot>;
  listAssets(): Promise<readonly import('../../domain/entities/MediaLibrary.js').MediaAsset[]>;
  getAsset(
    assetId: string,
  ): Promise<import('../../domain/entities/MediaLibrary.js').MediaAsset | null>;
  readBinary(assetId: string): Promise<Uint8Array>;
  ingestAsset(
    input: import('../../domain/entities/MediaLibrary.js').MediaAssetIngestInput,
  ): Promise<import('../../domain/entities/MediaLibrary.js').MediaAssetIngestResult>;
}
