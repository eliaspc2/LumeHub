export const SERVER_ACK = 2;

export type InboundMediaType = 'video' | 'image' | 'document' | 'audio';

interface RawBaileysMessageContextInfo {
  readonly mentionedJid?: readonly string[];
  readonly participant?: string;
  readonly stanzaId?: string;
}

interface RawBaileysMediaMessage {
  readonly mimetype?: string;
  readonly fileLength?: number | string | { readonly low?: number };
  readonly binary?: Uint8Array | ArrayBuffer | readonly number[];
  readonly contextInfo?: RawBaileysMessageContextInfo;
}

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
      readonly contextInfo?: RawBaileysMessageContextInfo;
    };
    readonly imageMessage?: RawBaileysMediaMessage & {
      readonly caption?: string;
    };
    readonly videoMessage?: RawBaileysMediaMessage & {
      readonly caption?: string;
      readonly seconds?: number;
    };
    readonly documentMessage?: RawBaileysMediaMessage & {
      readonly caption?: string;
      readonly fileName?: string;
    };
    readonly audioMessage?: RawBaileysMediaMessage & {
      readonly seconds?: number;
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
  readonly mentionedJids?: readonly string[];
  readonly quotedMessageId?: string;
  readonly quotedParticipantJid?: string;
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

export interface InboundMediaMessage {
  readonly messageId: string;
  readonly chatJid: string;
  readonly participantJid: string;
  readonly groupJid?: string;
  readonly timestamp: string;
  readonly pushName?: string;
  readonly mediaType: InboundMediaType;
  readonly mimeType: string;
  readonly fileName?: string;
  readonly caption: string | null;
  readonly fileSize: number | null;
  readonly durationSeconds: number | null;
  readonly binary: Uint8Array;
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

export type WhatsAppConnectionPhase = 'disabled' | 'idle' | 'connecting' | 'qr_pending' | 'open' | 'closed' | 'error';

export interface WhatsAppRuntimeFlags {
  readonly enabled: boolean;
  readonly groupDiscoveryEnabled: boolean;
  readonly conversationDiscoveryEnabled: boolean;
}

export interface WhatsAppQrSnapshot {
  readonly available: boolean;
  readonly value: string | null;
  readonly svg: string | null;
  readonly updatedAt: string | null;
  readonly expiresAt: string | null;
}

export interface WhatsAppSessionSnapshot {
  readonly phase: WhatsAppConnectionPhase;
  readonly connected: boolean;
  readonly loginRequired: boolean;
  readonly sessionPresent: boolean;
  readonly lastQrAt: string | null;
  readonly lastConnectedAt: string | null;
  readonly lastDisconnectAt: string | null;
  readonly lastDisconnectReason: string | null;
  readonly lastError: string | null;
  readonly selfJid: string | null;
  readonly pushName: string | null;
}

export interface WhatsAppDiscoveredGroup {
  readonly groupJid: string;
  readonly subject: string;
  readonly aliases: readonly string[];
  readonly size: number | null;
  readonly participants: readonly string[];
  readonly discoveredAt: string;
  readonly updatedAt: string;
}

export interface WhatsAppDiscoveredConversation {
  readonly chatJid: string;
  readonly displayName: string;
  readonly lastMessageAt: string | null;
  readonly lastMessagePreview: string | null;
  readonly unreadCount: number;
  readonly discoveredAt: string;
  readonly updatedAt: string;
}

export interface WhatsAppRuntimeSnapshot {
  readonly flags: WhatsAppRuntimeFlags;
  readonly session: WhatsAppSessionSnapshot;
  readonly qr: WhatsAppQrSnapshot;
  readonly groups: readonly WhatsAppDiscoveredGroup[];
  readonly conversations: readonly WhatsAppDiscoveredConversation[];
}

export interface WhatsAppRuntimeEvent {
  readonly topic: 'session' | 'qr' | 'groups' | 'conversations';
  readonly emittedAt: string;
  readonly snapshot: WhatsAppRuntimeSnapshot;
}

export interface IWhatsAppGateway {
  sendText(input: WhatsAppSendTextInput): Promise<WhatsAppSendResult>;
  ingestInboundEnvelope(payload: RawBaileysMessageEnvelope): Promise<NormalizedInboundMessage | undefined>;
  ingestOutboundObservation(signal: Omit<OutboundObservationSignal, 'observedAt'> & { readonly observedAt?: string }): Promise<OutboundObservationSignal | undefined>;
  ingestOutboundConfirmation(signal: Omit<OutboundConfirmationSignal, 'confirmedAt'> & { readonly confirmedAt?: string }): Promise<OutboundConfirmationSignal | undefined>;
  subscribeInbound(listener: (message: NormalizedInboundMessage) => void | Promise<void>): () => void;
  subscribeInboundMedia(listener: (message: InboundMediaMessage) => void | Promise<void>): () => void;
}

export interface IGroupMetadataProvider {
  getGroupMetadata(groupJid: string): Promise<GroupMetadataRecord | undefined>;
  setGroupMetadata(record: GroupMetadataRecord): Promise<void>;
}

export interface IOutboundSignalSource {
  subscribeOutboundObservation(listener: (signal: OutboundObservationSignal) => void | Promise<void>): () => void;
  subscribeOutboundConfirmation(listener: (signal: OutboundConfirmationSignal) => void | Promise<void>): () => void;
}

export interface IWhatsAppLiveRuntime {
  start(): Promise<void>;
  stop(): Promise<void>;
  applyRuntimeFlags(flags: Partial<WhatsAppRuntimeFlags>): Promise<WhatsAppRuntimeSnapshot>;
  refreshWorkspace(): Promise<WhatsAppRuntimeSnapshot>;
  getRuntimeSnapshot(): Promise<WhatsAppRuntimeSnapshot>;
  subscribeRuntime(listener: (event: WhatsAppRuntimeEvent) => void | Promise<void>): () => void;
}
