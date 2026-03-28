import type {
  MediaAsset,
  MediaAssetIngestInput,
  MediaAssetIngestResult,
  MediaLibrarySnapshot,
} from '../../domain/entities/MediaLibrary.js';
import { MediaLibraryRepository } from '../../infrastructure/persistence/MediaLibraryRepository.js';

export class MediaLibraryService {
  constructor(private readonly repository: MediaLibraryRepository) {}

  async getLibrary(): Promise<MediaLibrarySnapshot> {
    return this.repository.readLibrary();
  }

  async listAssets(): Promise<readonly MediaAsset[]> {
    return this.repository.listAssets();
  }

  async getAsset(assetId: string): Promise<MediaAsset | null> {
    return this.repository.getAsset(assetId);
  }

  async readBinary(assetId: string): Promise<Uint8Array> {
    return this.repository.readBinary(assetId);
  }

  async ingestAsset(input: MediaAssetIngestInput): Promise<MediaAssetIngestResult> {
    return this.repository.ingestAsset(input);
  }
}
