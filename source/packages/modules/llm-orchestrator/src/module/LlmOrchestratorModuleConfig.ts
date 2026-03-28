import type { LlmChatService } from '../application/services/LlmChatService.js';
import type { LlmScheduleParserService } from '../application/services/LlmScheduleParserService.js';
import type { LlmWeeklyPlannerService } from '../application/services/LlmWeeklyPlannerService.js';
import type { LlmProvider } from '../domain/entities/LlmOrchestrator.js';
import type { LlmRunLogger } from '../domain/services/LlmRunLogger.js';
import type { LlmProviderRegistry } from '../domain/services/LlmProviderRegistry.js';
import type { LlmRunLogRepository } from '../infrastructure/persistence/LlmRunLogRepository.js';

export interface LlmOrchestratorModuleConfig {
  readonly enabled?: boolean;
  readonly dataRootPath?: string;
  readonly runLogFilePath?: string;
  readonly providerId?: string;
  readonly providerResolver?: () => Promise<string | null | undefined> | string | null | undefined;
  readonly repository?: LlmRunLogRepository;
  readonly provider?: LlmProvider;
  readonly providerRegistry?: LlmProviderRegistry;
  readonly runLogger?: LlmRunLogger;
  readonly chatService?: LlmChatService;
  readonly scheduleParserService?: LlmScheduleParserService;
  readonly weeklyPlannerService?: LlmWeeklyPlannerService;
}
