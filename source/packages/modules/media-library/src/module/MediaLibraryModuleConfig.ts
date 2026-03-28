import type { MediaRetentionPolicy } from '../domain/entities/MediaLibrary.js';
import type { MediaLibraryRepository } from '../infrastructure/persistence/MediaLibraryRepository.js';
import type { MediaLibraryService } from '../application/services/MediaLibraryService.js';

export interface MediaLibraryModuleConfig {
  readonly dataRootPath?: string;
  readonly retentionPolicy?: MediaRetentionPolicy;
  readonly repository?: MediaLibraryRepository;
  readonly service?: MediaLibraryService;
}
