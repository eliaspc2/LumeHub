import type { Instruction, ScheduleApplyEnqueueInput } from '../../domain/entities/InstructionQueue.js';
import { InstructionQueueService } from './InstructionQueueService.js';

export class ScheduleApplyService {
  constructor(private readonly queueService: InstructionQueueService) {}

  async enqueueScheduleApply(input: ScheduleApplyEnqueueInput, now = new Date()): Promise<Instruction> {
    return this.queueService.enqueueInstruction(
      {
        sourceType: 'assistant_schedule_apply',
        sourceMessageId: input.payload.sourceMessageId,
        mode: input.mode,
        metadata: {
          contentKind: 'schedule_apply',
          operation: input.payload.operation,
          requestedText: input.payload.requestedText,
          requestedByPersonId: input.payload.requestedByPersonId,
          requestedByDisplayName: input.payload.requestedByDisplayName,
          requestedAccessMode: input.payload.requestedAccessMode,
          previewFingerprint: input.payload.previewFingerprint,
          previewSummary: input.payload.previewSummary,
          groupJid: input.payload.groupJid,
          groupLabel: input.payload.groupLabel,
          weekId: input.payload.weekId,
          targetEventId: input.payload.targetEventId,
          diff: input.payload.diff,
        },
        actions: [
          {
            type: 'schedule_apply',
            dedupeKey: input.dedupeKey?.trim() || buildScheduleApplyDedupeKey(input),
            targetGroupJid: input.payload.groupJid,
            payload: input.payload as unknown as Record<string, unknown>,
          },
        ],
      },
      now,
    );
  }
}

function buildScheduleApplyDedupeKey(input: ScheduleApplyEnqueueInput): string {
  return [
    'schedule_apply',
    input.payload.groupJid,
    input.payload.operation,
    input.payload.targetEventId ?? 'new',
    input.payload.previewFingerprint,
  ].join(':');
}
