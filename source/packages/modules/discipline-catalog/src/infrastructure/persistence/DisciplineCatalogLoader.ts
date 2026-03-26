import { readFile } from 'node:fs/promises';

import type { DisciplineCatalogFile } from '../../domain/entities/DisciplineCatalog.js';

export interface DisciplineCatalogLoaderConfig {
  readonly catalogFilePath?: string;
}

const EMPTY_CATALOG: DisciplineCatalogFile = {
  schemaVersion: 1,
  courses: [],
  disciplines: [],
};

export class DisciplineCatalogLoader {
  constructor(private readonly config: DisciplineCatalogLoaderConfig = {}) {}

  async load(): Promise<DisciplineCatalogFile> {
    if (!this.config.catalogFilePath) {
      return EMPTY_CATALOG;
    }

    try {
      const contents = await readFile(this.config.catalogFilePath, 'utf8');
      return normaliseCatalog(JSON.parse(contents) as DisciplineCatalogFile);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return EMPTY_CATALOG;
      }

      throw error;
    }
  }
}

function normaliseCatalog(catalog: DisciplineCatalogFile): DisciplineCatalogFile {
  return {
    schemaVersion: 1,
    courses: catalog.courses.map((course) => ({
      courseId: course.courseId.trim(),
      title: course.title.trim(),
      groupJid: course.groupJid.trim(),
      preferredSubject: course.preferredSubject.trim(),
      aliases: [...new Set((course.aliases ?? []).map((alias) => alias.trim()).filter(Boolean))],
    })),
    disciplines: catalog.disciplines.map((discipline) => ({
      code: discipline.code.trim(),
      title: discipline.title.trim(),
      courseId: discipline.courseId.trim(),
      aliases: [...new Set((discipline.aliases ?? []).map((alias) => alias.trim()).filter(Boolean))],
    })),
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
