import type { DistributionPlan } from '@lume-hub/audience-routing';

import type { AgentAssistantTurnInput } from '../entities/AgentRuntime.js';

export class ToolCallPolicy {
  canExecuteFanOut(input: AgentAssistantTurnInput, preview: DistributionPlan): boolean {
    return Boolean(
      input.allowActions &&
        preview.targetCount > 0 &&
        !preview.requiresConfirmation &&
        looksLikeExecutionRequest(input.text),
    );
  }
}

function looksLikeExecutionRequest(text: string): boolean {
  return /\b(distribui|envia|reencaminha|manda)\b/i.test(text) && /\b(agora|já|ja|confirmado)\b/i.test(text);
}
