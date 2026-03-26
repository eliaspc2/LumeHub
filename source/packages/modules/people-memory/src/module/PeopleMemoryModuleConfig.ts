import type { ImportantMemoryService } from '../application/services/ImportantMemoryService.js';
import type { PeopleDirectoryService } from '../application/services/PeopleDirectoryService.js';
import type { PersonIdentityMatcher } from '../domain/services/PersonIdentityMatcher.js';
import type { PeopleRepository } from '../infrastructure/persistence/PeopleRepository.js';

export interface PeopleMemoryModuleConfig {
  readonly enabled?: boolean;
  readonly peopleFilePath?: string;
  readonly repository?: PeopleRepository;
  readonly matcher?: PersonIdentityMatcher;
  readonly service?: PeopleDirectoryService;
  readonly importantMemoryService?: ImportantMemoryService;
}
