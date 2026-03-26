import type { ModuleContext } from '@lume-hub/kernel';
import { DisciplineCatalogModule } from './DisciplineCatalogModule.js';
import type { DisciplineCatalogModuleConfig } from './DisciplineCatalogModuleConfig.js';

export class DisciplineCatalogModuleFactory {
  create(_context: ModuleContext, config: DisciplineCatalogModuleConfig = {}): DisciplineCatalogModule {
    return new DisciplineCatalogModule(config);
  }
}
