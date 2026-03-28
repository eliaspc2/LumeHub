import type {
  DistributionActionPayload,
  Instruction,
  InstructionAction,
  InstructionActionExecutionResult,
  InstructionActionExecutorHandler,
} from '@lume-hub/instruction-queue';
import type { MediaAsset, MediaLibraryModuleContract } from '@lume-hub/media-library';
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
    if (action.type !== 'distribution_delivery') {
      return {
        note: `noop:${action.type}`,
      };
    }

    const payload = readDistributionActionPayload(action);

    if (payload.kind === 'media') {
      return this.executeMediaDistribution(action, instruction, payload);
    }

    return this.executeTextDistribution(action, instruction, payload);
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

function normaliseOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
