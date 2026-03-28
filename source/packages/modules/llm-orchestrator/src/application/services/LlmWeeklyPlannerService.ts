import type { WeeklyPromptPlan, WeeklyPromptPlanningInput } from '../../domain/entities/LlmOrchestrator.js';
import { LlmRunLogger } from '../../domain/services/LlmRunLogger.js';
import { LlmProviderRegistry } from '../../domain/services/LlmProviderRegistry.js';

export class LlmWeeklyPlannerService {
  constructor(
    private readonly registry: LlmProviderRegistry,
    private readonly runLogger: LlmRunLogger,
    private readonly providerId?: string,
    private readonly providerResolver?: () => Promise<string | null | undefined> | string | null | undefined,
  ) {}

  async planWeeklyPrompts(input: WeeklyPromptPlanningInput): Promise<WeeklyPromptPlan> {
    const provider = this.registry.resolve(await resolveProviderId(this.providerId, this.providerResolver));
    const result = await provider.planWeeklyPrompts(input);

    await this.runLogger.log({
      runId: `weekly-plan-${Date.now()}`,
      operation: 'plan_weekly_prompts',
      providerId: provider.providerId,
      modelId: provider.defaultModelId,
      inputSummary: input.weekId,
      outputSummary: result.prompts.join(' | ').slice(0, 160),
      createdAt: new Date().toISOString(),
    });

    return result;
  }
}

async function resolveProviderId(
  providerId: string | undefined,
  providerResolver?: () => Promise<string | null | undefined> | string | null | undefined,
): Promise<string | undefined> {
  const resolved = providerResolver ? await providerResolver() : undefined;
  return resolved ?? providerId;
}
