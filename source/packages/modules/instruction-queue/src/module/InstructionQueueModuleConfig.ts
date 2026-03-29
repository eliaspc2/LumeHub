import type { FanOutDistributionService } from '../application/services/FanOutDistributionService.js';
import type { InstructionQueueService } from '../application/services/InstructionQueueService.js';
import type { ScheduleApplyService } from '../application/services/ScheduleApplyService.js';
import type { InstructionActionExecutor } from '../domain/services/InstructionActionExecutor.js';
import type { InstructionWorker } from '../domain/services/InstructionWorker.js';
import type { StaleActionRecoveryService } from '../domain/services/StaleActionRecoveryService.js';
import type { InstructionQueueRepository } from '../infrastructure/persistence/InstructionQueueRepository.js';

export interface InstructionQueueModuleConfig {
  readonly enabled?: boolean;
  readonly dataRootPath?: string;
  readonly queueFilePath?: string;
  readonly repository?: InstructionQueueRepository;
  readonly actionExecutor?: InstructionActionExecutor;
  readonly staleActionRecovery?: StaleActionRecoveryService;
  readonly service?: InstructionQueueService;
  readonly worker?: InstructionWorker;
  readonly distributionService?: FanOutDistributionService;
  readonly scheduleApplyService?: ScheduleApplyService;
}
