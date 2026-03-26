import { BaseModule } from '@lume-hub/kernel';

import type { PersonIdentifier, PersonUpsertInput } from '../domain/entities/Person.js';
import { ImportantMemoryService } from '../application/services/ImportantMemoryService.js';
import { PeopleDirectoryService } from '../application/services/PeopleDirectoryService.js';
import { PersonIdentityMatcher } from '../domain/services/PersonIdentityMatcher.js';
import { PeopleRepository } from '../infrastructure/persistence/PeopleRepository.js';
import type { PeopleMemoryModuleContract } from '../public/contracts/index.js';
import type { PeopleMemoryModuleConfig } from './PeopleMemoryModuleConfig.js';

export class PeopleMemoryModule extends BaseModule implements PeopleMemoryModuleContract {
  readonly moduleName = 'people-memory' as const;
  readonly service: PeopleDirectoryService;
  readonly importantMemoryService: ImportantMemoryService;

  constructor(readonly config: PeopleMemoryModuleConfig = {}) {
    super({
      name: 'people-memory',
      version: '0.1.0',
      dependencies: [],
    });

    const repository =
      config.repository ??
      new PeopleRepository({
        peopleFilePath: config.peopleFilePath,
      });
    const matcher = config.matcher ?? new PersonIdentityMatcher();

    this.service = config.service ?? new PeopleDirectoryService(repository, matcher);
    this.importantMemoryService = config.importantMemoryService ?? new ImportantMemoryService(repository);
  }

  async listPeople() {
    return this.service.listPeople();
  }

  async findPersonById(personId: string) {
    return this.service.findPersonById(personId);
  }

  async findByIdentifiers(identifiers: readonly PersonIdentifier[]) {
    return this.service.findByIdentifiers(identifiers);
  }

  async upsertByIdentifiers(input: PersonUpsertInput) {
    return this.service.upsertByIdentifiers(input);
  }

  async appendImportantNote(personId: string, text: string) {
    return this.importantMemoryService.appendImportantNote(personId, text);
  }

  async listImportantNotes(personId: string) {
    return this.importantMemoryService.listImportantNotes(personId);
  }

  async isAppOwner(personId: string) {
    return this.service.isAppOwner(personId);
  }
}
