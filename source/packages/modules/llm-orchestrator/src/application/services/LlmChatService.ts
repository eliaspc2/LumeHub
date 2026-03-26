import type { LlmChatInput, LlmChatResult } from '../../domain/entities/LlmOrchestrator.js';
import { LlmRunLogger } from '../../domain/services/LlmRunLogger.js';
import { LlmProviderRegistry } from '../../domain/services/LlmProviderRegistry.js';

export class LlmChatService {
  constructor(
    private readonly registry: LlmProviderRegistry,
    private readonly runLogger: LlmRunLogger,
    private readonly providerId?: string,
  ) {}

  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    const provider = this.registry.resolve(this.providerId);
    const result = await provider.chat(input);

    await this.runLogger.log({
      runId: result.runId,
      operation: 'chat',
      providerId: result.providerId,
      modelId: result.modelId,
      inputSummary: input.text.slice(0, 160),
      outputSummary: result.text.slice(0, 160),
      createdAt: new Date().toISOString(),
    });

    return result;
  }
}
