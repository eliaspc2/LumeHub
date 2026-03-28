import { BaseModule } from '@lume-hub/kernel';

import { MediaLibraryService } from '../application/services/MediaLibraryService.js';
import { MediaLibraryRepository } from '../infrastructure/persistence/MediaLibraryRepository.js';
import type { MediaLibraryModuleContract } from '../public/contracts/index.js';
import type { MediaLibraryModuleConfig } from './MediaLibraryModuleConfig.js';

export class MediaLibraryModule extends BaseModule implements MediaLibraryModuleContract {
  readonly moduleName = 'media-library' as const;
  readonly service: MediaLibraryService;

  constructor(readonly config: MediaLibraryModuleConfig = {}) {
    super({
      name: 'media-library',
      version: '0.1.0',
      dependencies: [],
    });

    this.service =
      config.service ??
      new MediaLibraryService(
        config.repository ??
          new MediaLibraryRepository({
            dataRootPath: config.dataRootPath,
            retentionPolicy: config.retentionPolicy,
          }),
      );
  }

  async getLibrary() {
    return this.service.getLibrary();
  }

  async listAssets() {
    return this.service.listAssets();
  }

  async getAsset(assetId: string) {
    return this.service.getAsset(assetId);
  }

  async readBinary(assetId: string) {
    return this.service.readBinary(assetId);
  }

  async ingestAsset(input: Parameters<MediaLibraryService['ingestAsset']>[0]) {
    return this.service.ingestAsset(input);
  }
}
