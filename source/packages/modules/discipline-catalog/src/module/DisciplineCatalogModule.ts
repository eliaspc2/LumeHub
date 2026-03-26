import { BaseModule } from '@lume-hub/kernel';
import type { DisciplineCatalogModuleConfig } from './DisciplineCatalogModuleConfig.js';

export class DisciplineCatalogModule extends BaseModule {
  constructor(readonly config: DisciplineCatalogModuleConfig = {}) {
    super({
      name: 'discipline-catalog',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
