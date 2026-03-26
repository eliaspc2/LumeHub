import { readFile } from 'node:fs/promises';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

import type { PeopleMemoryFile } from '../../domain/entities/Person.js';

const EMPTY_PEOPLE_MEMORY: PeopleMemoryFile = {
  schemaVersion: 1,
  people: [],
  notes: [],
};

export interface PeopleRepositoryConfig {
  readonly peopleFilePath?: string;
}

export class PeopleRepository {
  constructor(
    private readonly config: PeopleRepositoryConfig = {},
    private readonly writer = new AtomicJsonWriter(),
  ) {}

  async read(): Promise<PeopleMemoryFile> {
    if (!this.config.peopleFilePath) {
      return EMPTY_PEOPLE_MEMORY;
    }

    try {
      return JSON.parse(await readFile(this.config.peopleFilePath, 'utf8')) as PeopleMemoryFile;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return EMPTY_PEOPLE_MEMORY;
      }

      throw error;
    }
  }

  async save(value: PeopleMemoryFile): Promise<PeopleMemoryFile> {
    if (!this.config.peopleFilePath) {
      return value;
    }

    await this.writer.write(this.config.peopleFilePath, value);
    return value;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
