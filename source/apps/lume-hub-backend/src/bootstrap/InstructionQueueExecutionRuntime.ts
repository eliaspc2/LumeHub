import type {
  DistributionActionPayload,
  Instruction,
  InstructionAction,
  InstructionActionExecutionResult,
  InstructionActionExecutorHandler,
  ScheduleApplyActionPayload,
} from '@lume-hub/instruction-queue';
import type { MediaAsset, MediaLibraryModuleContract } from '@lume-hub/media-library';
import type { WeeklyPlannerEventSummary, WeeklyPlannerModuleContract } from '@lume-hub/weekly-planner';
import type { WhatsAppSendMediaInput } from '@lume-hub/whatsapp-baileys';

interface UiEventPublisherLike {
  publish<TPayload>(topic: string, payload: TPayload, now?: Date): {
    readonly eventId: string;
    readonly topic: string;
    readonly emittedAt: string;
    readonly payload: TPayload;
  };
}

interface WhatsAppDistributionRuntimeLike {
  sendText(input: {
    readonly chatJid: string;
    readonly text: string;
    readonly idempotencyKey?: string;
    readonly messageId?: string;
  }): Promise<{
    readonly messageId: string;
    readonly chatJid: string;
    readonly acceptedAt: string;
    readonly idempotencyKey?: string;
  }>;
  sendMedia(input: WhatsAppSendMediaInput): Promise<{
    readonly messageId: string;
    readonly chatJid: string;
    readonly acceptedAt: string;
    readonly idempotencyKey?: string;
  }>;
}

export interface InstructionQueueExecutionRuntimeConfig {
  readonly whatsAppRuntime: WhatsAppDistributionRuntimeLike;
  readonly mediaLibrary: Pick<MediaLibraryModuleContract, 'getAsset' | 'readBinary'>;
  readonly weeklyPlanner: Pick<WeeklyPlannerModuleContract, 'deleteSchedule' | 'saveSchedule'>;
  readonly uiEventPublisher?: UiEventPublisherLike;
}

export class InstructionQueueExecutionRuntime {
  constructor(private readonly config: InstructionQueueExecutionRuntimeConfig) {}

  createHandler(): InstructionActionExecutorHandler {
    return async (action, instruction) => this.executeAction(action, instruction);
  }

  private async executeAction(
    action: InstructionAction,
    instruction: Instruction,
  ): Promise<InstructionActionExecutionResult> {
    if (action.type === 'schedule_apply') {
      return this.executeScheduleApply(action, instruction);
    }

    if (action.type === 'distribution_delivery') {
      const payload = readDistributionActionPayload(action);

      if (payload.kind === 'media') {
        return this.executeMediaDistribution(action, instruction, payload);
      }

      return this.executeTextDistribution(action, instruction, payload);
    }

    return {
      note: `noop:${action.type}`,
    };
  }

  private async executeTextDistribution(
    action: InstructionAction,
    instruction: Instruction,
    payload: Extract<DistributionActionPayload, { readonly kind: 'text' }>,
  ): Promise<InstructionActionExecutionResult> {
    const sendResult = await this.config.whatsAppRuntime.sendText({
      chatJid: payload.targetGroupJid,
      text: payload.messageText,
      idempotencyKey: buildIdempotencyKey(instruction, action),
    });

    const result = {
      externalMessageId: sendResult.messageId,
      note: 'distribution_text_accepted',
      metadata: {
        contentKind: 'text',
        targetGroupJid: payload.targetGroupJid,
        targetLabel: payload.targetLabel,
        requiresConfirmation: payload.requiresConfirmation,
        acceptedAt: sendResult.acceptedAt,
      },
    } satisfies InstructionActionExecutionResult;

    this.publish('instruction.distribution.accepted', {
      instructionId: instruction.instructionId,
      actionId: action.actionId,
      ...result.metadata,
      externalMessageId: sendResult.messageId,
    });
    return result;
  }

  private async executeMediaDistribution(
    action: InstructionAction,
    instruction: Instruction,
    payload: Extract<DistributionActionPayload, { readonly kind: 'media' }>,
  ): Promise<InstructionActionExecutionResult> {
    const asset = await this.readRequiredMediaAsset(payload.assetId);
    const binary = await this.config.mediaLibrary.readBinary(asset.assetId);
    const outboundMediaType = resolveOutboundMediaType(asset);
    const caption = payload.caption?.trim() || asset.caption || null;
    const sendResult = await this.config.whatsAppRuntime.sendMedia({
      chatJid: payload.targetGroupJid,
      mediaType: outboundMediaType,
      mimeType: asset.mimeType,
      binary,
      caption,
      fileName: buildOutboundFileName(asset),
      idempotencyKey: buildIdempotencyKey(instruction, action),
    });

    const result = {
      externalMessageId: sendResult.messageId,
      note: 'distribution_media_accepted',
      metadata: {
        contentKind: 'media',
        assetId: asset.assetId,
        mediaType: outboundMediaType,
        mimeType: asset.mimeType,
        caption,
        targetGroupJid: payload.targetGroupJid,
        targetLabel: payload.targetLabel,
        requiresConfirmation: payload.requiresConfirmation,
        acceptedAt: sendResult.acceptedAt,
      },
    } satisfies InstructionActionExecutionResult;

    this.publish('instruction.distribution.media.accepted', {
      instructionId: instruction.instructionId,
      actionId: action.actionId,
      ...result.metadata,
      externalMessageId: sendResult.messageId,
    });
    return result;
  }

  private async executeScheduleApply(
    action: InstructionAction,
    instruction: Instruction,
  ): Promise<InstructionActionExecutionResult> {
    const payload = readScheduleApplyPayload(action);

    if (payload.operation === 'delete') {
      if (!payload.deleteEventId) {
        throw new Error(`Schedule delete payload for action '${action.actionId}' is missing deleteEventId.`);
      }

      const deleted = await this.config.weeklyPlanner.deleteSchedule(payload.deleteEventId, {
        groupJid: payload.groupJid,
      });

      if (!deleted) {
        throw new Error(`Schedule '${payload.deleteEventId}' could not be deleted.`);
      }

      const result = {
        note: 'schedule_deleted',
        metadata: {
          contentKind: 'schedule_apply',
          operation: payload.operation,
          groupJid: payload.groupJid,
          groupLabel: payload.groupLabel,
          weekId: payload.weekId,
          eventId: payload.deleteEventId,
          title: payload.targetEvent?.title ?? null,
          previewSummary: payload.previewSummary,
        },
      } satisfies InstructionActionExecutionResult;

      this.publish('schedules.deleted', {
        eventId: payload.deleteEventId,
        deleted: true,
      });
      this.publish('instruction.schedule_apply.completed', {
        instructionId: instruction.instructionId,
        actionId: action.actionId,
        ...result.metadata,
      });
      return result;
    }

    if (!payload.upsert) {
      throw new Error(`Schedule ${payload.operation} payload for action '${action.actionId}' is missing upsert data.`);
    }

    const saved = await this.config.weeklyPlanner.saveSchedule(payload.upsert);
    const result = {
      note: payload.operation === 'create' ? 'schedule_created' : 'schedule_updated',
      metadata: {
        contentKind: 'schedule_apply',
        operation: payload.operation,
        groupJid: saved.groupJid,
        groupLabel: saved.groupLabel,
        weekId: saved.weekId,
        eventId: saved.eventId,
        title: saved.title,
        startTime: saved.startTime,
        localDate: saved.localDate,
        previewSummary: payload.previewSummary,
        appliedEvent: saved,
      },
    } satisfies InstructionActionExecutionResult;

    this.publish('schedules.updated', {
      eventId: saved.eventId,
      groupJid: saved.groupJid,
      weekId: saved.weekId,
    });
    this.publish('instruction.schedule_apply.completed', {
      instructionId: instruction.instructionId,
      actionId: action.actionId,
      ...result.metadata,
    });
    return result;
  }

  private async readRequiredMediaAsset(assetId: string): Promise<MediaAsset> {
    const asset = await this.config.mediaLibrary.getAsset(assetId);

    if (!asset || !asset.exists) {
      throw new Error(`Media asset '${assetId}' was not found or is missing on disk.`);
    }

    return asset;
  }

  private publish(topic: string, payload: unknown): void {
    this.config.uiEventPublisher?.publish(topic, payload);
  }
}

function readDistributionActionPayload(
  action: InstructionAction,
): Extract<DistributionActionPayload, { readonly kind: 'text' }> | Extract<DistributionActionPayload, { readonly kind: 'media' }> {
  const payload = action.payload as Partial<DistributionActionPayload>;

  if (
    payload.kind === 'media' &&
    typeof payload.assetId === 'string' &&
    payload.assetId.trim() &&
    typeof payload.targetGroupJid === 'string' &&
    payload.targetGroupJid.trim() &&
    typeof payload.targetLabel === 'string' &&
    payload.targetLabel.trim()
  ) {
    return {
      kind: 'media',
      sourceMessageId: String(payload.sourceMessageId ?? ''),
      sourcePersonId: normaliseOptionalString(payload.sourcePersonId),
      sourceDisplayName: normaliseOptionalString(payload.sourceDisplayName),
      assetId: payload.assetId.trim(),
      caption: normaliseOptionalString(payload.caption),
      targetGroupJid: payload.targetGroupJid.trim(),
      targetLabel: payload.targetLabel.trim(),
      requiresConfirmation: Boolean(payload.requiresConfirmation),
    };
  }

  if (
    payload.kind === 'text' &&
    typeof payload.messageText === 'string' &&
    payload.messageText.trim() &&
    typeof payload.targetGroupJid === 'string' &&
    payload.targetGroupJid.trim() &&
    typeof payload.targetLabel === 'string' &&
    payload.targetLabel.trim()
  ) {
    return {
      kind: 'text',
      sourceMessageId: String(payload.sourceMessageId ?? ''),
      sourcePersonId: normaliseOptionalString(payload.sourcePersonId),
      sourceDisplayName: normaliseOptionalString(payload.sourceDisplayName),
      messageText: payload.messageText.trim(),
      targetGroupJid: payload.targetGroupJid.trim(),
      targetLabel: payload.targetLabel.trim(),
      requiresConfirmation: Boolean(payload.requiresConfirmation),
    };
  }

  throw new Error(`Unsupported distribution payload for action '${action.actionId}'.`);
}

function readScheduleApplyPayload(action: InstructionAction): ScheduleApplyActionPayload {
  const payload = action.payload as Partial<ScheduleApplyActionPayload>;

  if (
    payload.kind !== 'schedule_apply' ||
    typeof payload.groupJid !== 'string' ||
    !payload.groupJid.trim() ||
    typeof payload.weekId !== 'string' ||
    !payload.weekId.trim() ||
    typeof payload.previewFingerprint !== 'string' ||
    !payload.previewFingerprint.trim() ||
    typeof payload.previewSummary !== 'string' ||
    !payload.previewSummary.trim() ||
    !isScheduleApplyOperation(payload.operation)
  ) {
    throw new Error(`Unsupported schedule apply payload for action '${action.actionId}'.`);
  }

  return {
    kind: 'schedule_apply',
    operation: payload.operation,
    sourceMessageId: normaliseRequiredString(payload.sourceMessageId, 'sourceMessageId', action.actionId),
    requestedText: normaliseRequiredString(payload.requestedText, 'requestedText', action.actionId),
    requestedByPersonId: normaliseOptionalString(payload.requestedByPersonId),
    requestedByDisplayName: normaliseOptionalString(payload.requestedByDisplayName),
    requestedAccessMode:
      payload.requestedAccessMode === 'read' || payload.requestedAccessMode === 'read_write'
        ? payload.requestedAccessMode
        : null,
    previewFingerprint: payload.previewFingerprint.trim(),
    previewSummary: payload.previewSummary.trim(),
    groupJid: payload.groupJid.trim(),
    groupLabel: normaliseOptionalString(payload.groupLabel),
    weekId: payload.weekId.trim(),
    targetEventId: normaliseOptionalString(payload.targetEventId),
    targetEvent: normaliseOptionalWeeklyPlannerEvent(payload.targetEvent),
    diff: Array.isArray(payload.diff)
      ? payload.diff.map((entry) => ({
          label: typeof entry?.label === 'string' ? entry.label.trim() : 'campo',
          before: typeof entry?.before === 'string' ? entry.before.trim() : entry?.before == null ? null : String(entry.before),
          after: typeof entry?.after === 'string' ? entry.after.trim() : entry?.after == null ? null : String(entry.after),
          changed: Boolean(entry?.changed),
        }))
      : [],
    upsert: payload.upsert && typeof payload.upsert === 'object' ? (payload.upsert as ScheduleApplyActionPayload['upsert']) : null,
    deleteEventId: normaliseOptionalString(payload.deleteEventId),
  };
}

function normaliseOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normaliseRequiredString(value: unknown, fieldName: string, actionId: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Schedule apply payload for action '${actionId}' is missing '${fieldName}'.`);
  }

  return value.trim();
}

function isScheduleApplyOperation(value: unknown): value is ScheduleApplyActionPayload['operation'] {
  return value === 'create' || value === 'update' || value === 'delete';
}

function normaliseOptionalWeeklyPlannerEvent(value: unknown): WeeklyPlannerEventSummary | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const event = value as Partial<WeeklyPlannerEventSummary>;

  if (
    typeof event.eventId !== 'string' ||
    typeof event.weekId !== 'string' ||
    typeof event.groupJid !== 'string' ||
    typeof event.groupLabel !== 'string' ||
    typeof event.title !== 'string' ||
    typeof event.eventAt !== 'string' ||
    typeof event.localDate !== 'string' ||
    typeof event.dayLabel !== 'string' ||
    typeof event.startTime !== 'string' ||
    typeof event.durationMinutes !== 'number' ||
    typeof event.notes !== 'string'
  ) {
    return null;
  }

  return {
    eventId: event.eventId,
    weekId: event.weekId,
    groupJid: event.groupJid,
    groupLabel: event.groupLabel,
    title: event.title,
    eventAt: event.eventAt,
    localDate: event.localDate,
    dayLabel: event.dayLabel,
    startTime: event.startTime,
    durationMinutes: event.durationMinutes,
    notes: event.notes,
    notificationRuleLabels: Array.isArray(event.notificationRuleLabels) ? event.notificationRuleLabels : [],
    notifications:
      event.notifications && typeof event.notifications === 'object'
        ? {
            pending: Number(event.notifications.pending ?? 0),
            waitingConfirmation: Number(event.notifications.waitingConfirmation ?? 0),
            sent: Number(event.notifications.sent ?? 0),
            total: Number(event.notifications.total ?? 0),
          }
        : {
            pending: 0,
            waitingConfirmation: 0,
            sent: 0,
            total: 0,
          },
  };
}

function buildIdempotencyKey(instruction: Instruction, action: InstructionAction): string {
  return `${instruction.instructionId}:${action.actionId}`;
}

function resolveOutboundMediaType(asset: MediaAsset): Exclude<WhatsAppSendMediaInput['mediaType'], never> {
  if (asset.mediaType !== 'other') {
    return asset.mediaType;
  }

  if (asset.mimeType.startsWith('video/')) {
    return 'video';
  }

  if (asset.mimeType.startsWith('image/')) {
    return 'image';
  }

  if (asset.mimeType.startsWith('audio/')) {
    return 'audio';
  }

  return 'document';
}

function buildOutboundFileName(asset: MediaAsset): string | null {
  if (asset.mediaType !== 'document') {
    return null;
  }

  const extension = extensionFromMimeType(asset.mimeType);
  return `${asset.assetId}${extension}`;
}

function extensionFromMimeType(mimeType: string): string {
  switch (mimeType.trim().toLowerCase()) {
    case 'application/pdf':
      return '.pdf';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return '.docx';
    case 'application/msword':
      return '.doc';
    default: {
      const subtype = mimeType.split('/')[1]?.trim();
      return subtype ? `.${subtype.replace(/[^a-z0-9.+-]/gi, '')}` : '.bin';
    }
  }
}
