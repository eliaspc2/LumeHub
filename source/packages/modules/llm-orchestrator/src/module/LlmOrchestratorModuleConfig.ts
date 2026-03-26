import type { LlmChatService } from '../application/services/LlmChatService.js';
import type { LlmScheduleParserService } from '../application/services/LlmScheduleParserService.js';
import type { LlmWeeklyPlannerService } from '../application/services/LlmWeeklyPlannerService.js';
import type { LlmRunLogger } from '../domain/services/LlmRunLogger.js';
import type { LlmProviderRegistry } from '../domain/services/LlmProviderRegistry.js';
import type { DeterministicLlmProvider } from '../infrastructure/providers/DeterministicLlmProvider.js';
import type { LlmRunLogRepository } from '../infrastructure/persistence/LlmRunLogRepository.js';

export interface LlmOrchestratorModuleConfig {
  readonly enabled?: boolean;
  readonly dataRootPath?: string;
  readonly runLogFilePath?: string;
  readonly providerId?: string;
  readonly repository?: LlmRunLogRepository;
  readonly provider?: DeterministicLlmProvider;
  readonly providerRegistry?: LlmProviderRegistry;
  readonly runLogger?: LlmRunLogger;
  readonly chatService?: LlmChatService;
  readonly scheduleParserService?: LlmScheduleParserService;
  readonly weeklyPlannerService?: LlmWeeklyPlannerService;
}
