import { GroupPathResolver } from '@lume-hub/persistence-group-files';

import type { GroupDirectoryService } from '../application/services/GroupDirectoryService.js';
import type { GroupRepository } from '../infrastructure/persistence/GroupRepository.js';

export interface GroupDirectoryModuleConfig {
  readonly enabled?: boolean;
  readonly dataRootPath?: string;
  readonly groupSeedFilePath?: string;
  readonly pathResolver?: GroupPathResolver;
  readonly repository?: GroupRepository;
  readonly service?: GroupDirectoryService;
}
