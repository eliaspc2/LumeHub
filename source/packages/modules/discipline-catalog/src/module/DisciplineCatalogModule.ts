import { BaseModule } from '@lume-hub/kernel';

import { DisciplineCatalogService } from '../application/services/DisciplineCatalogService.js';
import { DisciplineCatalogLoader } from '../infrastructure/persistence/DisciplineCatalogLoader.js';
import type { DisciplineCatalogModuleContract } from '../public/contracts/index.js';
import type { DisciplineCatalogModuleConfig } from './DisciplineCatalogModuleConfig.js';

export class DisciplineCatalogModule extends BaseModule implements DisciplineCatalogModuleContract {
  readonly moduleName = 'discipline-catalog' as const;
  readonly service: DisciplineCatalogService;

  constructor(readonly config: DisciplineCatalogModuleConfig = {}) {
    super({
      name: 'discipline-catalog',
      version: '0.1.0',
      dependencies: [],
    });

    this.service =
      config.service ??
      new DisciplineCatalogService(
        config.loader ??
          new DisciplineCatalogLoader({
            catalogFilePath: config.catalogFilePath,
          }),
      );
  }

  async findByCode(code: string) {
    return this.service.findByCode(code);
  }

  async findFromText(text: string) {
    return this.service.findFromText(text);
  }

  async listCourses() {
    return this.service.listCourses();
  }

  async listDisciplines() {
    return this.service.listDisciplines();
  }

  async findCourseById(courseId: string) {
    return this.service.findCourseById(courseId);
  }

  async listGroupsForCourse(courseId: string) {
    return this.service.listGroupsForCourse(courseId);
  }

  async reload() {
    return this.service.reload();
  }
}
