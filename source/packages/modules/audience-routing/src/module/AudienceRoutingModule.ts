import { DisciplineCatalogModule } from '@lume-hub/discipline-catalog';
import { GroupDirectoryModule } from '@lume-hub/group-directory';
import { BaseModule } from '@lume-hub/kernel';
import { PeopleMemoryModule } from '@lume-hub/people-memory';

import { AudienceRoutingService } from '../application/services/AudienceRoutingService.js';
import type { ResolveTargetsForSenderInput, SenderAudienceRuleUpsertInput } from '../domain/entities/AudienceRouting.js';
import { DistributionPlanBuilder } from '../domain/services/DistributionPlanBuilder.js';
import { FanOutPolicyEvaluator } from '../domain/services/FanOutPolicyEvaluator.js';
import { SenderAudienceRepository } from '../infrastructure/persistence/SenderAudienceRepository.js';
import type { AudienceRoutingModuleContract } from '../public/contracts/index.js';
import type { AudienceRoutingModuleConfig } from './AudienceRoutingModuleConfig.js';

export class AudienceRoutingModule extends BaseModule implements AudienceRoutingModuleContract {
  readonly moduleName = 'audience-routing' as const;
  readonly service: AudienceRoutingService;

  constructor(readonly config: AudienceRoutingModuleConfig = {}) {
    super({
      name: 'audience-routing',
      version: '0.1.0',
      dependencies: ['group-directory', 'discipline-catalog', 'people-memory'],
    });

    const groupDirectory =
      config.groupDirectory ??
      new GroupDirectoryModule({
        dataRootPath: config.dataRootPath,
        groupSeedFilePath: config.groupSeedFilePath,
      });
    const disciplineCatalog =
      config.disciplineCatalog ??
      new DisciplineCatalogModule({
        catalogFilePath: config.catalogFilePath,
      });
    const peopleMemory =
      config.peopleMemory ??
      new PeopleMemoryModule({
        peopleFilePath: config.peopleFilePath,
      });
    const repository =
      config.repository ??
      new SenderAudienceRepository({
        rulesFilePath: config.rulesFilePath,
      });
    const evaluator = config.evaluator ?? new FanOutPolicyEvaluator();
    const planBuilder = config.planBuilder ?? new DistributionPlanBuilder(groupDirectory, disciplineCatalog);

    this.service =
      config.service ??
      new AudienceRoutingService(
        repository,
        groupDirectory,
        disciplineCatalog,
        peopleMemory,
        evaluator,
        planBuilder,
      );
  }

  async resolveTargetsForSender(input: ResolveTargetsForSenderInput) {
    return this.service.resolveTargetsForSender(input);
  }

  async previewDistributionPlan(sourceMessageId: string, input: ResolveTargetsForSenderInput) {
    return this.service.previewDistributionPlan(sourceMessageId, input);
  }

  async upsertSenderAudienceRule(input: SenderAudienceRuleUpsertInput) {
    return this.service.upsertSenderAudienceRule(input);
  }

  async listSenderAudienceRules() {
    return this.service.listSenderAudienceRules();
  }
}
