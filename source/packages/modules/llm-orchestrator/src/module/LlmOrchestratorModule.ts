import { BaseModule } from '@lume-hub/kernel';

import { LlmChatService } from '../application/services/LlmChatService.js';
import { LlmScheduleParserService } from '../application/services/LlmScheduleParserService.js';
import { LlmWeeklyPlannerService } from '../application/services/LlmWeeklyPlannerService.js';
import { LlmRunLogger } from '../domain/services/LlmRunLogger.js';
import { LlmProviderRegistry } from '../domain/services/LlmProviderRegistry.js';
import { DeterministicLlmProvider } from '../infrastructure/providers/DeterministicLlmProvider.js';
import { LlmRunLogRepository } from '../infrastructure/persistence/LlmRunLogRepository.js';
import type { LlmOrchestratorModuleContract } from '../public/contracts/index.js';
import type { LlmOrchestratorModuleConfig } from './LlmOrchestratorModuleConfig.js';

export class LlmOrchestratorModule extends BaseModule implements LlmOrchestratorModuleContract {
  readonly moduleName = 'llm-orchestrator' as const;
  readonly chatService: LlmChatService;
  readonly scheduleParserService: LlmScheduleParserService;
  readonly weeklyPlannerService: LlmWeeklyPlannerService;
  readonly providerRegistry: LlmProviderRegistry;

  constructor(readonly config: LlmOrchestratorModuleConfig = {}) {
    super({
      name: 'llm-orchestrator',
      version: '0.1.0',
      dependencies: [],
    });

    const provider = config.provider ?? new DeterministicLlmProvider();
    const repository =
      config.repository ??
      new LlmRunLogRepository({
        dataRootPath: config.dataRootPath,
        runLogFilePath: config.runLogFilePath,
      });
    const providerRegistry = config.providerRegistry ?? new LlmProviderRegistry([provider]);
    const runLogger = config.runLogger ?? new LlmRunLogger(repository);

    this.providerRegistry = providerRegistry;
    this.chatService = config.chatService ?? new LlmChatService(providerRegistry, runLogger, config.providerId);
    this.scheduleParserService =
      config.scheduleParserService ?? new LlmScheduleParserService(providerRegistry, runLogger, config.providerId);
    this.weeklyPlannerService =
      config.weeklyPlannerService ?? new LlmWeeklyPlannerService(providerRegistry, runLogger, config.providerId);
  }

  async chat(input: Parameters<LlmChatService['chat']>[0]) {
    return this.chatService.chat(input);
  }

  async parseSchedules(input: Parameters<LlmScheduleParserService['parseSchedules']>[0]) {
    return this.scheduleParserService.parseSchedules(input);
  }

  async planWeeklyPrompts(input: Parameters<LlmWeeklyPlannerService['planWeeklyPrompts']>[0]) {
    return this.weeklyPlannerService.planWeeklyPrompts(input);
  }

  listModels() {
    return this.providerRegistry.listModels();
  }
}
