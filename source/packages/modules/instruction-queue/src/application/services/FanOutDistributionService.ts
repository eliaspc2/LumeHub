import type { DistributionPlanEnqueueInput, Instruction } from '../../domain/entities/InstructionQueue.js';
import { InstructionQueueService } from './InstructionQueueService.js';

export class FanOutDistributionService {
  constructor(private readonly queueService: InstructionQueueService) {}

  async enqueueDistributionPlan(input: DistributionPlanEnqueueInput, now = new Date()): Promise<Instruction> {
    return this.queueService.enqueueInstruction(
      {
        sourceType: 'fanout_distribution',
        sourceMessageId: input.plan.sourceMessageId,
        mode: input.mode,
        metadata: {
          senderPersonId: input.plan.senderPersonId,
          senderDisplayName: input.plan.senderDisplayName,
          requiresConfirmation: input.plan.requiresConfirmation,
          matchedRuleIds: input.plan.matchedRuleIds,
          matchedDisciplineCodes: input.plan.matchedDisciplineCodes,
          targetCount: input.plan.targetCount,
          contentKind: input.content.kind,
          assetId: input.content.kind === 'media' ? input.content.assetId : null,
        },
        actions: input.plan.targets.map((target) => ({
          type: 'distribution_delivery',
          dedupeKey:
            input.content.kind === 'media'
              ? `${input.content.assetId}:${input.plan.sourceMessageId}:${target.groupJid}`
              : target.dedupeKey,
          targetGroupJid: target.groupJid,
          payload: {
            kind: input.content.kind,
            sourceMessageId: input.plan.sourceMessageId,
            sourcePersonId: input.plan.senderPersonId,
            sourceDisplayName: input.plan.senderDisplayName,
            targetGroupJid: target.groupJid,
            targetLabel: target.preferredSubject,
            requiresConfirmation: input.plan.requiresConfirmation,
            ...(input.content.kind === 'media'
              ? {
                  assetId: input.content.assetId,
                  caption: input.content.caption?.trim() || null,
                }
              : {
                  messageText: input.content.messageText,
                }),
          },
        })),
      },
      now,
    );
  }
}
