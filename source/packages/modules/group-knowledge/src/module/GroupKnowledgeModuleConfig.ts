import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';

import type { GroupKnowledgeService } from '../application/services/GroupKnowledgeService.js';
import type { GroupKnowledgeRepository } from '../infrastructure/persistence/GroupKnowledgeRepository.js';

export interface GroupKnowledgeModuleConfig {
  readonly enabled?: boolean;
  readonly dataRootPath?: string;
  readonly groupDirectory?: GroupDirectoryModuleContract;
  readonly repository?: GroupKnowledgeRepository;
  readonly service?: GroupKnowledgeService;
}
