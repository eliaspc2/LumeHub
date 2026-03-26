import type { LlmScheduleParseInput, LlmScheduleParseResult } from '../../domain/entities/LlmOrchestrator.js';
import { LlmRunLogger } from '../../domain/services/LlmRunLogger.js';
import { LlmProviderRegistry } from '../../domain/services/LlmProviderRegistry.js';

export class LlmScheduleParserService {
  constructor(
    private readonly registry: LlmProviderRegistry,
    private readonly runLogger: LlmRunLogger,
    private readonly providerId?: string,
  ) {}

  async parseSchedules(input: LlmScheduleParseInput): Promise<LlmScheduleParseResult> {
    const provider = this.registry.resolve(this.providerId);
    const result = await provider.parseSchedules(input);

    await this.runLogger.log({
      runId: `schedule-parse-${Date.now()}`,
      operation: 'parse_schedules',
      providerId: provider.providerId,
      modelId: provider.defaultModelId,
      inputSummary: input.text.slice(0, 160),
      outputSummary: JSON.stringify(result.candidates).slice(0, 160),
      createdAt: new Date().toISOString(),
    });

    return result;
  }
}
