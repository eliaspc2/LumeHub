import type { DisciplineCatalogModuleContract } from '@lume-hub/discipline-catalog';
import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { PeopleMemoryModuleContract } from '@lume-hub/people-memory';

import type { AudienceRoutingService } from '../application/services/AudienceRoutingService.js';
import type { DistributionPlanBuilder } from '../domain/services/DistributionPlanBuilder.js';
import type { FanOutPolicyEvaluator } from '../domain/services/FanOutPolicyEvaluator.js';
import type { SenderAudienceRepository } from '../infrastructure/persistence/SenderAudienceRepository.js';

export interface AudienceRoutingModuleConfig {
  readonly enabled?: boolean;
  readonly dataRootPath?: string;
  readonly groupSeedFilePath?: string;
  readonly catalogFilePath?: string;
  readonly peopleFilePath?: string;
  readonly rulesFilePath?: string;
  readonly groupDirectory?: GroupDirectoryModuleContract;
  readonly disciplineCatalog?: DisciplineCatalogModuleContract;
  readonly peopleMemory?: Pick<PeopleMemoryModuleContract, 'findPersonById' | 'findByIdentifiers'>;
  readonly repository?: SenderAudienceRepository;
  readonly evaluator?: FanOutPolicyEvaluator;
  readonly planBuilder?: DistributionPlanBuilder;
  readonly service?: AudienceRoutingService;
}
