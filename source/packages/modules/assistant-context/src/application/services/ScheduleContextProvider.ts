import type { SchedulingContext } from '../../domain/entities/AssistantContext.js';
import type { AssistantChatContext, BuildSchedulingContextInput } from '../../domain/entities/AssistantContext.js';

export class ScheduleContextProvider {
  build(input: BuildSchedulingContextInput, chatContext: AssistantChatContext): SchedulingContext {
    const resolvedGroupJids = dedupeStrings([
      input.groupJid ?? null,
      chatContext.groupJid,
      chatContext.activeReference?.groupJid ?? null,
    ]);

    return {
      chatContext,
      requestedAccessMode: input.requestedAccessMode ?? null,
      resolvedGroupJids,
    };
  }
}

function dedupeStrings(values: readonly (string | null | undefined)[]): readonly string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}
