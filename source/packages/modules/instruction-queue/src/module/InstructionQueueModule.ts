import { BaseModule } from '@lume-hub/kernel';

import { FanOutDistributionService } from '../application/services/FanOutDistributionService.js';
import { InstructionQueueService } from '../application/services/InstructionQueueService.js';
import { ScheduleApplyService } from '../application/services/ScheduleApplyService.js';
import type {
  DistributionPlanEnqueueInput,
  InstructionEnqueueInput,
  ScheduleApplyEnqueueInput,
} from '../domain/entities/InstructionQueue.js';
import { InstructionActionExecutor } from '../domain/services/InstructionActionExecutor.js';
import { InstructionWorker } from '../domain/services/InstructionWorker.js';
import { StaleActionRecoveryService } from '../domain/services/StaleActionRecoveryService.js';
import { InstructionQueueRepository } from '../infrastructure/persistence/InstructionQueueRepository.js';
import type { InstructionQueueModuleContract } from '../public/contracts/index.js';
import type { InstructionQueueModuleConfig } from './InstructionQueueModuleConfig.js';

export class InstructionQueueModule extends BaseModule implements InstructionQueueModuleContract {
  readonly moduleName = 'instruction-queue' as const;
  readonly service: InstructionQueueService;
  readonly worker: InstructionWorker;
  readonly distributionService: FanOutDistributionService;
  readonly scheduleApplyService: ScheduleApplyService;

  constructor(readonly config: InstructionQueueModuleConfig = {}) {
    super({
      name: 'instruction-queue',
      version: '0.1.0',
      dependencies: [],
    });

    const repository =
      config.repository ??
      new InstructionQueueRepository({
        dataRootPath: config.dataRootPath,
        queueFilePath: config.queueFilePath,
      });
    const staleActionRecovery = config.staleActionRecovery ?? new StaleActionRecoveryService(repository);
    const actionExecutor = config.actionExecutor ?? new InstructionActionExecutor();

    this.service = config.service ?? new InstructionQueueService(repository, actionExecutor, staleActionRecovery);
    this.worker = config.worker ?? new InstructionWorker(this.service);
    this.distributionService = config.distributionService ?? new FanOutDistributionService(this.service);
    this.scheduleApplyService = config.scheduleApplyService ?? new ScheduleApplyService(this.service);
  }

  async enqueueInstruction(input: InstructionEnqueueInput) {
    return this.service.enqueueInstruction(input);
  }

  async enqueueDistributionPlan(input: DistributionPlanEnqueueInput) {
    return this.distributionService.enqueueDistributionPlan(input);
  }

  async enqueueScheduleApply(input: ScheduleApplyEnqueueInput) {
    return this.scheduleApplyService.enqueueScheduleApply(input);
  }

  async retryInstruction(instructionId: string) {
    return this.service.retryInstruction(instructionId);
  }

  async tickWorker(now?: Date) {
    return this.worker.tick(now);
  }

  async listInstructions() {
    return this.service.listInstructions();
  }
}
