export const SERVER_ACK = 2;

export interface RawBaileysMessageEnvelope {
  readonly key?: {
    readonly id?: string;
    readonly remoteJid?: string;
    readonly participant?: string;
    readonly fromMe?: boolean;
  };
  readonly message?: {
    readonly conversation?: string;
    readonly extendedTextMessage?: {
      readonly text?: string;
    };
    readonly imageMessage?: {
      readonly caption?: string;
    };
    readonly videoMessage?: {
      readonly caption?: string;
    };
  };
  readonly messageTimestamp?: number | string | { readonly low?: number };
  readonly pushName?: string;
}

export interface NormalizedInboundMessage {
  readonly messageId: string;
  readonly chatJid: string;
  readonly participantJid: string;
  readonly groupJid?: string;
  readonly fromMe: boolean;
  readonly text: string;
  readonly timestamp: string;
  readonly semanticFingerprint: string;
  readonly pushName?: string;
}

export interface OutboundObservationSignal {
  readonly jobId?: string;
  readonly messageId: string;
  readonly chatJid: string;
  readonly observedAt: string;
  readonly source: string;
}

export interface OutboundConfirmationSignal {
  readonly jobId?: string;
  readonly messageId: string;
  readonly chatJid: string;
  readonly confirmedAt: string;
  readonly source: string;
  readonly ack: number;
}

export interface WhatsAppSendTextInput {
  readonly chatJid: string;
  readonly text: string;
  readonly idempotencyKey?: string;
  readonly messageId?: string;
}

export interface WhatsAppSendResult {
  readonly messageId: string;
  readonly chatJid: string;
  readonly acceptedAt: string;
  readonly idempotencyKey?: string;
}

export interface GroupMetadataRecord {
  readonly groupJid: string;
  readonly subject: string;
  readonly size?: number;
  readonly participants?: readonly string[];
  readonly updatedAt: string;
}

export interface IWhatsAppGateway {
  sendText(input: WhatsAppSendTextInput): Promise<WhatsAppSendResult>;
  ingestInboundEnvelope(payload: RawBaileysMessageEnvelope): Promise<NormalizedInboundMessage | undefined>;
  ingestOutboundObservation(signal: Omit<OutboundObservationSignal, 'observedAt'> & { readonly observedAt?: string }): Promise<OutboundObservationSignal | undefined>;
  ingestOutboundConfirmation(signal: Omit<OutboundConfirmationSignal, 'confirmedAt'> & { readonly confirmedAt?: string }): Promise<OutboundConfirmationSignal | undefined>;
  subscribeInbound(listener: (message: NormalizedInboundMessage) => void | Promise<void>): () => void;
}

export interface IGroupMetadataProvider {
  getGroupMetadata(groupJid: string): Promise<GroupMetadataRecord | undefined>;
  setGroupMetadata(record: GroupMetadataRecord): Promise<void>;
}

export interface IOutboundSignalSource {
  subscribeOutboundObservation(listener: (signal: OutboundObservationSignal) => void | Promise<void>): () => void;
  subscribeOutboundConfirmation(listener: (signal: OutboundConfirmationSignal) => void | Promise<void>): () => void;
}
