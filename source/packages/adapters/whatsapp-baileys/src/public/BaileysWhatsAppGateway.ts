import { randomUUID } from 'node:crypto';

import { GroupMetadataCache } from './GroupMetadataCache.js';
import { InboundMessageNormalizer } from './InboundMessageNormalizer.js';
import { OutboundConfirmationTracker } from './OutboundConfirmationTracker.js';
import type {
  GroupMetadataRecord,
  IGroupMetadataProvider,
  IOutboundSignalSource,
  IWhatsAppGateway,
  NormalizedInboundMessage,
  OutboundConfirmationSignal,
  OutboundObservationSignal,
  RawBaileysMessageEnvelope,
  WhatsAppSendResult,
  WhatsAppSendTextInput,
} from './types.js';

export interface WhatsappBaileysAdapterConfig {
  readonly enabled?: boolean;
}

export interface BaileysWhatsAppGatewayOptions extends WhatsappBaileysAdapterConfig {
  readonly normalizer?: InboundMessageNormalizer;
  readonly tracker?: OutboundConfirmationTracker;
  readonly metadataCache?: GroupMetadataCache;
  readonly semanticDedupeWindowMs?: number;
}

type AsyncListener<TValue> = (value: TValue) => void | Promise<void>;

export class BaileysWhatsAppGateway implements IWhatsAppGateway, IGroupMetadataProvider, IOutboundSignalSource {
  private readonly normalizer: InboundMessageNormalizer;
  private readonly tracker: OutboundConfirmationTracker;
  private readonly metadataCache: GroupMetadataCache;
  private readonly semanticDedupeWindowMs: number;
  private readonly seenMessageIds = new Set<string>();
  private readonly semanticSeenAt = new Map<string, number>();
  private readonly inboundListeners = new Set<AsyncListener<NormalizedInboundMessage>>();
  private readonly observationListeners = new Set<AsyncListener<OutboundObservationSignal>>();
  private readonly confirmationListeners = new Set<AsyncListener<OutboundConfirmationSignal>>();

  constructor(readonly config: BaileysWhatsAppGatewayOptions = {}) {
    this.normalizer = config.normalizer ?? new InboundMessageNormalizer();
    this.tracker = config.tracker ?? new OutboundConfirmationTracker();
    this.metadataCache = config.metadataCache ?? new GroupMetadataCache();
    this.semanticDedupeWindowMs = config.semanticDedupeWindowMs ?? 15_000;
  }

  describe(): Readonly<Record<string, unknown>> {
    return {
      adapter: 'whatsapp-baileys',
      enabled: this.config.enabled ?? true,
    };
  }

  async sendText(input: WhatsAppSendTextInput): Promise<WhatsAppSendResult> {
    return {
      messageId: input.messageId ?? `wamid.${randomUUID()}`,
      chatJid: input.chatJid,
      acceptedAt: new Date().toISOString(),
      idempotencyKey: input.idempotencyKey,
    };
  }

  async ingestInboundEnvelope(payload: RawBaileysMessageEnvelope): Promise<NormalizedInboundMessage | undefined> {
    const normalized = this.normalizer.normalize(payload);

    if (!normalized || this.seenMessageIds.has(normalized.messageId) || this.isSemanticDuplicate(normalized)) {
      return undefined;
    }

    this.seenMessageIds.add(normalized.messageId);
    this.semanticSeenAt.set(
      `${normalized.participantJid}:${normalized.semanticFingerprint}`,
      Date.parse(normalized.timestamp),
    );

    await this.emit(this.inboundListeners, normalized);
    return normalized;
  }

  async ingestOutboundObservation(
    signal: Omit<OutboundObservationSignal, 'observedAt'> & { readonly observedAt?: string },
  ): Promise<OutboundObservationSignal | undefined> {
    const normalized = this.tracker.captureObservation(signal);

    if (!normalized) {
      return undefined;
    }

    await this.emit(this.observationListeners, normalized);
    return normalized;
  }

  async ingestOutboundConfirmation(
    signal: Omit<OutboundConfirmationSignal, 'confirmedAt'> & { readonly confirmedAt?: string },
  ): Promise<OutboundConfirmationSignal | undefined> {
    const normalized = this.tracker.captureConfirmation(signal);

    if (!normalized) {
      return undefined;
    }

    await this.emit(this.confirmationListeners, normalized);
    return normalized;
  }

  subscribeInbound(listener: AsyncListener<NormalizedInboundMessage>): () => void {
    this.inboundListeners.add(listener);
    return () => this.inboundListeners.delete(listener);
  }

  subscribeOutboundObservation(listener: AsyncListener<OutboundObservationSignal>): () => void {
    this.observationListeners.add(listener);
    return () => this.observationListeners.delete(listener);
  }

  subscribeOutboundConfirmation(listener: AsyncListener<OutboundConfirmationSignal>): () => void {
    this.confirmationListeners.add(listener);
    return () => this.confirmationListeners.delete(listener);
  }

  async getGroupMetadata(groupJid: string): Promise<GroupMetadataRecord | undefined> {
    return this.metadataCache.get(groupJid);
  }

  async setGroupMetadata(record: GroupMetadataRecord): Promise<void> {
    this.metadataCache.set(record);
  }

  private isSemanticDuplicate(message: NormalizedInboundMessage): boolean {
    const key = `${message.participantJid}:${message.semanticFingerprint}`;
    const previousSeenAt = this.semanticSeenAt.get(key);
    const currentSeenAt = Date.parse(message.timestamp);

    if (previousSeenAt === undefined) {
      return false;
    }

    return currentSeenAt - previousSeenAt <= this.semanticDedupeWindowMs;
  }

  private async emit<TValue>(listeners: Set<AsyncListener<TValue>>, value: TValue): Promise<void> {
    for (const listener of listeners) {
      await listener(value);
    }
  }
}
