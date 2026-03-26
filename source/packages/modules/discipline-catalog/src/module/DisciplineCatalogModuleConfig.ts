import type { DisciplineCatalogService } from '../application/services/DisciplineCatalogService.js';
import type { DisciplineCatalogLoader } from '../infrastructure/persistence/DisciplineCatalogLoader.js';

export interface DisciplineCatalogModuleConfig {
  readonly enabled?: boolean;
  readonly catalogFilePath?: string;
  readonly loader?: DisciplineCatalogLoader;
  readonly service?: DisciplineCatalogService;
}
