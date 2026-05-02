import { randomUUID } from 'node:crypto';

import {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  extractMessageContent,
  fetchLatestBaileysVersion,
  isJidGroup,
  makeWASocket,
  useMultiFileAuthState,
  type AuthenticationState,
  type Chat,
  type Contact,
  type ConnectionState,
  type GroupMetadata,
  type UserFacingSocketConfig,
  type WAMessage,
  type WAMessageUpdate,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';

import { BaileysReconnectPolicy } from './BaileysReconnectPolicy.js';
import { BaileysSessionStore } from './BaileysSessionStore.js';
import { GroupMetadataCache } from './GroupMetadataCache.js';
import { InboundMessageNormalizer } from './InboundMessageNormalizer.js';
import { OutboundConfirmationTracker } from './OutboundConfirmationTracker.js';
import type {
  GroupMetadataRecord,
  IGroupMetadataProvider,
  IOutboundSignalSource,
  IWhatsAppGateway,
  IWhatsAppLiveRuntime,
  InboundMediaMessage,
  NormalizedInboundMessage,
  OutboundConfirmationSignal,
  OutboundObservationSignal,
  RawBaileysMessageEnvelope,
  WhatsAppDiscoveredConversation,
  WhatsAppDiscoveredGroup,
  WhatsAppQrSnapshot,
  WhatsAppRuntimeEvent,
  WhatsAppRuntimeFlags,
  WhatsAppRuntimeSnapshot,
  WhatsAppSendMediaInput,
  WhatsAppSendResult,
  WhatsAppSendTextInput,
  WhatsAppSessionSnapshot,
} from './types.js';

export interface WhatsappBaileysAdapterConfig extends Partial<WhatsAppRuntimeFlags> {
  readonly accountId?: string;
  readonly authRootPath?: string;
  readonly autoConnect?: boolean;
  readonly browserLabel?: string;
  readonly qrTtlMs?: number;
}

export interface BaileysSocketLike {
  readonly ev: {
    on(event: string, listener: (value: any) => void): void;
    off(event: string, listener: (value: any) => void): void;
  };
  readonly user?: {
    readonly id?: string | null;
    readonly lid?: string | null;
    readonly name?: string | null;
    readonly notify?: string | null;
  };
  sendMessage(
    jid: string,
    content:
      | {
          readonly text: string;
        }
      | {
          readonly image?: Uint8Array | Buffer;
          readonly video?: Uint8Array | Buffer;
          readonly audio?: Uint8Array | Buffer;
          readonly document?: Uint8Array | Buffer;
          readonly mimetype?: string;
          readonly caption?: string;
          readonly fileName?: string;
          readonly ptt?: boolean;
        },
    options?: {
      readonly messageId?: string;
    },
  ): Promise<WAMessage | undefined>;
  groupFetchAllParticipating(): Promise<Record<string, GroupMetadata>>;
  updateMediaMessage?(message: WAMessage): Promise<WAMessage>;
  logout(message?: string): Promise<void>;
  end(error?: Error): void;
}

export interface BaileysSocketFactoryInput {
  readonly authState: AuthenticationState;
  readonly browser: readonly [string, string, string];
  readonly logger: BaileysLoggerLike;
  readonly version?: readonly [number, number, number];
}

export type BaileysSocketFactory = (input: BaileysSocketFactoryInput) => Promise<BaileysSocketLike>;
export type BaileysVersionResolver = () => Promise<{
  readonly version: readonly [number, number, number];
}>;

export interface BaileysWhatsAppGatewayOptions extends WhatsappBaileysAdapterConfig {
  readonly normalizer?: InboundMessageNormalizer;
  readonly tracker?: OutboundConfirmationTracker;
  readonly metadataCache?: GroupMetadataCache;
  readonly reconnectPolicy?: BaileysReconnectPolicy;
  readonly sessionStore?: BaileysSessionStore;
  readonly semanticDedupeWindowMs?: number;
  readonly socketFactory?: BaileysSocketFactory;
  readonly versionResolver?: BaileysVersionResolver;
}

type AsyncListener<TValue> = (value: TValue) => void | Promise<void>;

interface BaileysLoggerLike {
  level: string;
  child(bindings: Record<string, unknown>): BaileysLoggerLike;
  trace(...values: readonly unknown[]): void;
  debug(...values: readonly unknown[]): void;
  info(...values: readonly unknown[]): void;
  warn(...values: readonly unknown[]): void;
  error(...values: readonly unknown[]): void;
  fatal(...values: readonly unknown[]): void;
}

const DEFAULT_QR_TTL_MS = 60_000;
const OBSERVED_ACK = 1;
const RAW_MESSAGE_WRAPPER_KEYS = [
  'deviceSentMessage',
  'groupMentionedMessage',
  'botInvokeMessage',
  'ephemeralMessage',
  'viewOnceMessage',
  'documentWithCaptionMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'editedMessage',
] as const;

export class BaileysWhatsAppGateway
  implements IWhatsAppGateway, IGroupMetadataProvider, IOutboundSignalSource, IWhatsAppLiveRuntime
{
  private readonly normalizer: InboundMessageNormalizer;
  private readonly tracker: OutboundConfirmationTracker;
  private readonly metadataCache: GroupMetadataCache;
  private readonly reconnectPolicy: BaileysReconnectPolicy;
  private readonly sessionStore: BaileysSessionStore;
  private readonly semanticDedupeWindowMs: number;
  private readonly socketFactory: BaileysSocketFactory;
  private readonly versionResolver: BaileysVersionResolver;
  private readonly accountId: string;
  private readonly browserLabel: string;
  private readonly autoConnect: boolean;
  private readonly qrTtlMs: number;
  private readonly seenMessageIds = new Set<string>();
  private readonly semanticSeenAt = new Map<string, number>();
  private readonly messageIdToChatJid = new Map<string, string>();
  private readonly discoveredGroups = new Map<string, WhatsAppDiscoveredGroup>();
  private readonly discoveredConversations = new Map<string, WhatsAppDiscoveredConversation>();
  private readonly contactLabels = new Map<string, string>();
  private readonly inboundListeners = new Set<AsyncListener<NormalizedInboundMessage>>();
  private readonly inboundMediaListeners = new Set<AsyncListener<InboundMediaMessage>>();
  private readonly observationListeners = new Set<AsyncListener<OutboundObservationSignal>>();
  private readonly confirmationListeners = new Set<AsyncListener<OutboundConfirmationSignal>>();
  private readonly runtimeListeners = new Set<AsyncListener<WhatsAppRuntimeEvent>>();
  private readonly seenInboundMediaMessageIds = new Set<string>();

  private runtimeFlags: WhatsAppRuntimeFlags;
  private qrSnapshot: WhatsAppQrSnapshot = {
    available: false,
    value: null,
    svg: null,
    updatedAt: null,
    expiresAt: null,
  };
  private sessionSnapshot: WhatsAppSessionSnapshot;
  private socket?: BaileysSocketLike;
  private socketCleanups: (() => void)[] = [];
  private connectPromise?: Promise<void>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempts = 0;
  private startRequested = false;
  private stopRequested = false;

  constructor(readonly config: BaileysWhatsAppGatewayOptions = {}) {
    this.normalizer = config.normalizer ?? new InboundMessageNormalizer();
    this.tracker = config.tracker ?? new OutboundConfirmationTracker();
    this.metadataCache = config.metadataCache ?? new GroupMetadataCache();
    this.reconnectPolicy = config.reconnectPolicy ?? new BaileysReconnectPolicy();
    this.sessionStore = config.sessionStore ?? new BaileysSessionStore({
      authRootPath: config.authRootPath,
    });
    this.semanticDedupeWindowMs = config.semanticDedupeWindowMs ?? 15_000;
    this.socketFactory = config.socketFactory ?? defaultSocketFactory;
    this.versionResolver = config.versionResolver ?? fetchLatestBaileysVersion;
    this.accountId = config.accountId ?? 'default';
    this.browserLabel = config.browserLabel ?? 'LumeHub';
    this.autoConnect = config.autoConnect ?? true;
    this.qrTtlMs = Math.max(15_000, config.qrTtlMs ?? DEFAULT_QR_TTL_MS);
    this.runtimeFlags = {
      enabled: config.enabled ?? true,
      groupDiscoveryEnabled: config.groupDiscoveryEnabled ?? true,
      conversationDiscoveryEnabled: config.conversationDiscoveryEnabled ?? true,
    };
    this.sessionSnapshot = {
      phase: this.runtimeFlags.enabled ? 'idle' : 'disabled',
      connected: false,
      loginRequired: true,
      sessionPresent: false,
      lastQrAt: null,
      lastConnectedAt: null,
      lastDisconnectAt: null,
      lastDisconnectReason: null,
      lastError: null,
      selfJid: null,
      selfLid: null,
      pushName: null,
    };
  }

  describe(): Readonly<Record<string, unknown>> {
    return {
      adapter: 'whatsapp-baileys',
      ...this.runtimeFlags,
      accountId: this.accountId,
      sessionPhase: this.sessionSnapshot.phase,
    };
  }

  async start(): Promise<void> {
    this.startRequested = true;
    this.stopRequested = false;
    await this.refreshSessionPresence();

    if (this.runtimeFlags.enabled && this.autoConnect) {
      await this.ensureSocket();
    } else {
      await this.emitRuntimeEvent('session');
    }
  }

  async stop(): Promise<void> {
    this.startRequested = false;
    this.stopRequested = true;
    this.clearReconnectTimer();
    await this.detachCurrentSocket({
      logout: false,
    });
    this.clearQrSnapshot();
    await this.refreshSessionPresence();
    this.sessionSnapshot = {
      ...this.sessionSnapshot,
      connected: false,
      phase: this.runtimeFlags.enabled ? 'closed' : 'disabled',
    };
    await this.emitRuntimeEvent('session');
  }

  async applyRuntimeFlags(flags: Partial<WhatsAppRuntimeFlags>): Promise<WhatsAppRuntimeSnapshot> {
    this.runtimeFlags = {
      ...this.runtimeFlags,
      ...flags,
    };

    if (!this.runtimeFlags.enabled) {
      this.clearReconnectTimer();
      await this.detachCurrentSocket({
        logout: false,
      });
      this.clearQrSnapshot();
      await this.refreshSessionPresence();
      this.sessionSnapshot = {
        ...this.sessionSnapshot,
        connected: false,
        phase: 'disabled',
      };
      await this.emitRuntimeEvent('session');
      return this.getRuntimeSnapshot();
    }

    await this.refreshSessionPresence();

    if (this.startRequested) {
      await this.ensureSocket();
    } else {
      this.sessionSnapshot = {
        ...this.sessionSnapshot,
        phase: this.socket ? this.sessionSnapshot.phase : 'idle',
      };
      await this.emitRuntimeEvent('session');
    }

    return this.getRuntimeSnapshot();
  }

  async refreshWorkspace(): Promise<WhatsAppRuntimeSnapshot> {
    await this.refreshSessionPresence();

    if (!this.runtimeFlags.enabled) {
      return this.getRuntimeSnapshot();
    }

    if (this.startRequested) {
      await this.ensureSocket();
    }

    if (this.socket && this.sessionSnapshot.connected && this.runtimeFlags.groupDiscoveryEnabled) {
      try {
        const groups = await this.socket.groupFetchAllParticipating();
        await this.ingestGroupsUpsert(Object.values(groups));
      } catch (error) {
        this.sessionSnapshot = {
          ...this.sessionSnapshot,
          lastError: readErrorMessage(error),
        };
        await this.emitRuntimeEvent('session');
      }
    }

    return this.getRuntimeSnapshot();
  }

  async resetSession(): Promise<WhatsAppRuntimeSnapshot> {
    const nowIso = new Date().toISOString();

    this.clearReconnectTimer();
    await this.detachCurrentSocket({
      logout: true,
    });
    await this.sessionStore.clearSession(this.accountId);
    this.clearQrSnapshot();
    this.clearWorkspaceCache();
    this.reconnectAttempts = 0;
    await this.refreshSessionPresence();
    this.sessionSnapshot = {
      ...this.sessionSnapshot,
      phase: this.runtimeFlags.enabled ? (this.startRequested && this.autoConnect ? 'connecting' : 'idle') : 'disabled',
      connected: false,
      loginRequired: true,
      sessionPresent: false,
      lastQrAt: null,
      lastConnectedAt: null,
      lastDisconnectAt: nowIso,
      lastDisconnectReason: 'session_reset',
      lastError: null,
      selfJid: null,
      selfLid: null,
      pushName: null,
    };
    await this.emitRuntimeEvent('session');

    if (this.runtimeFlags.enabled && this.startRequested && this.autoConnect) {
      await this.ensureSocket();
    }

    return this.getRuntimeSnapshot();
  }

  async getRuntimeSnapshot(): Promise<WhatsAppRuntimeSnapshot> {
    return {
      flags: {
        ...this.runtimeFlags,
      },
      session: {
        ...this.sessionSnapshot,
      },
      qr: {
        ...this.qrSnapshot,
      },
      groups: [...this.discoveredGroups.values()].sort((left, right) =>
        left.subject.localeCompare(right.subject, 'pt-PT'),
      ),
      conversations: [...this.discoveredConversations.values()].sort((left, right) =>
        left.displayName.localeCompare(right.displayName, 'pt-PT'),
      ),
    };
  }

  subscribeRuntime(listener: AsyncListener<WhatsAppRuntimeEvent>): () => void {
    this.runtimeListeners.add(listener);
    return () => this.runtimeListeners.delete(listener);
  }

  async sendText(input: WhatsAppSendTextInput): Promise<WhatsAppSendResult> {
    if (!this.socket || !this.sessionSnapshot.connected) {
      throw new Error('WhatsApp live session is not connected.');
    }

    const result = await this.socket.sendMessage(
      input.chatJid,
      {
        text: input.text,
      },
      input.messageId
        ? {
            messageId: input.messageId,
          }
        : undefined,
    );

    const messageId = result?.key?.id ?? input.messageId ?? `wamid.${randomUUID()}`;
    this.messageIdToChatJid.set(messageId, input.chatJid);

    return {
      messageId,
      chatJid: input.chatJid,
      acceptedAt: new Date().toISOString(),
      idempotencyKey: input.idempotencyKey,
    };
  }

  async sendMedia(input: WhatsAppSendMediaInput): Promise<WhatsAppSendResult> {
    if (!this.socket || !this.sessionSnapshot.connected) {
      throw new Error('WhatsApp live session is not connected.');
    }

    const result = await this.socket.sendMessage(
      input.chatJid,
      buildOutboundMediaContent(input),
      input.messageId
        ? {
            messageId: input.messageId,
          }
        : undefined,
    );

    const messageId = result?.key?.id ?? input.messageId ?? `wamid.${randomUUID()}`;
    this.messageIdToChatJid.set(messageId, input.chatJid);

    return {
      messageId,
      chatJid: input.chatJid,
      acceptedAt: new Date().toISOString(),
      idempotencyKey: input.idempotencyKey,
    };
  }

  async ingestInboundEnvelope(payload: RawBaileysMessageEnvelope): Promise<NormalizedInboundMessage | undefined> {
    const normalized = this.normalizer.normalize(payload);

    if (!normalized) {
      console.warn(
        '[whatsapp-inbound] normalize_failed',
        JSON.stringify(buildInboundNormalizeFailureSummary(payload)),
      );
      return undefined;
    }

    if (this.seenMessageIds.has(normalized.messageId) || this.isSemanticDuplicate(normalized)) {
      return undefined;
    }

    this.seenMessageIds.add(normalized.messageId);
    this.semanticSeenAt.set(
      `${normalized.participantJid}:${normalized.semanticFingerprint}`,
      Date.parse(normalized.timestamp),
    );

    this.messageIdToChatJid.set(normalized.messageId, normalized.chatJid);

    if (this.runtimeFlags.conversationDiscoveryEnabled && !normalized.groupJid) {
      this.upsertConversation(
        {
          chatJid: normalized.chatJid,
          displayName: normalized.pushName?.trim() || this.contactLabels.get(normalized.chatJid) || normalized.chatJid,
          lastMessageAt: normalized.timestamp,
          lastMessagePreview: normalized.text,
          unreadCount: this.discoveredConversations.get(normalized.chatJid)?.unreadCount ?? 0,
        },
        new Date(normalized.timestamp),
      );
      await this.emitRuntimeEvent('conversations');
    }

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

  subscribeInboundMedia(listener: AsyncListener<InboundMediaMessage>): () => void {
    this.inboundMediaListeners.add(listener);
    return () => this.inboundMediaListeners.delete(listener);
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

  async ingestConnectionUpdate(update: Partial<ConnectionState>, now = new Date()): Promise<void> {
    if (update.qr) {
      const nowIso = now.toISOString();
      this.qrSnapshot = {
        available: true,
        value: update.qr,
        svg: await QRCode.toString(update.qr, {
          type: 'svg',
          margin: 1,
          width: 240,
        }),
        updatedAt: nowIso,
        expiresAt: new Date(now.getTime() + this.qrTtlMs).toISOString(),
      };
      this.sessionSnapshot = {
        ...this.sessionSnapshot,
        phase: 'qr_pending',
        connected: false,
        loginRequired: true,
        lastQrAt: nowIso,
        lastError: null,
      };
      await this.emitRuntimeEvent('qr');
      return;
    }

    if (update.connection === 'connecting') {
      this.sessionSnapshot = {
        ...this.sessionSnapshot,
        phase: 'connecting',
        connected: false,
        lastError: null,
      };
      await this.emitRuntimeEvent('session');
      return;
    }

    if (update.connection === 'open') {
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();
      this.clearQrSnapshot();
      await this.refreshSessionPresence();
      this.sessionSnapshot = {
        ...this.sessionSnapshot,
        phase: 'open',
        connected: true,
        loginRequired: false,
        lastConnectedAt: now.toISOString(),
        lastError: null,
        selfJid: normaliseJid(this.socket?.user?.id ?? null),
        selfLid: normaliseJid(this.socket?.user?.lid ?? null),
        pushName: normaliseLabel(this.socket?.user?.name ?? this.socket?.user?.notify ?? null),
      };
      await this.emitRuntimeEvent('session');
      await this.refreshWorkspace();
      return;
    }

    if (update.connection === 'close') {
      this.clearQrSnapshot();
      this.clearSocketReference();

      const disconnectReason = readDisconnectReason(update.lastDisconnect?.error);
      const sessionInvalidated = disconnectReason === DisconnectReason.loggedOut;

      if (sessionInvalidated) {
        await this.sessionStore.clearSession(this.accountId);
      }

      await this.refreshSessionPresence();
      this.sessionSnapshot = {
        ...this.sessionSnapshot,
        phase: this.runtimeFlags.enabled && this.shouldReconnect(disconnectReason) ? 'error' : 'closed',
        connected: false,
        loginRequired: sessionInvalidated || !this.sessionSnapshot.sessionPresent,
        lastDisconnectAt: now.toISOString(),
        lastDisconnectReason: disconnectReason === null ? null : String(disconnectReason),
        lastError: readErrorMessage(update.lastDisconnect?.error),
      };
      await this.emitRuntimeEvent('session');

      if (this.shouldReconnect(disconnectReason)) {
        this.scheduleReconnect();
      }
    }
  }

  async ingestGroupsUpsert(groups: readonly GroupMetadata[], now = new Date()): Promise<void> {
    if (!this.runtimeFlags.groupDiscoveryEnabled) {
      return;
    }

    let changed = false;

    for (const group of groups) {
      const mapped = mapGroup(group, now);

      if (!mapped) {
        continue;
      }

      const current = this.discoveredGroups.get(mapped.groupJid);
      const nextGroup: WhatsAppDiscoveredGroup = current
        ? {
            ...mapped,
            discoveredAt: current.discoveredAt,
          }
        : mapped;

      if (!current || JSON.stringify(current) !== JSON.stringify(nextGroup)) {
        this.discoveredGroups.set(mapped.groupJid, nextGroup);
        this.metadataCache.set({
          groupJid: nextGroup.groupJid,
          subject: nextGroup.subject,
          size: nextGroup.size ?? undefined,
          participants: nextGroup.participants,
          updatedAt: nextGroup.updatedAt,
        });
        changed = true;
      }
    }

    if (changed) {
      await this.emitRuntimeEvent('groups');
    }
  }

  async ingestChatsUpsert(chats: readonly Chat[], now = new Date()): Promise<void> {
    if (!this.runtimeFlags.conversationDiscoveryEnabled) {
      return;
    }

    let changed = false;

    for (const chat of chats) {
      const mapped = mapChat(chat, this.contactLabels, now);

      if (!mapped) {
        continue;
      }

      const current = this.discoveredConversations.get(mapped.chatJid);
      const nextConversation: WhatsAppDiscoveredConversation = current
        ? {
            ...mapped,
            discoveredAt: current.discoveredAt,
            lastMessagePreview: mapped.lastMessagePreview ?? current.lastMessagePreview,
            lastMessageAt: mapped.lastMessageAt ?? current.lastMessageAt,
          }
        : mapped;

      if (!current || JSON.stringify(current) !== JSON.stringify(nextConversation)) {
        this.discoveredConversations.set(mapped.chatJid, nextConversation);
        changed = true;
      }
    }

    if (changed) {
      await this.emitRuntimeEvent('conversations');
    }
  }

  async ingestMessagesUpdate(updates: readonly WAMessageUpdate[]): Promise<void> {
    for (const update of updates) {
      const messageId = update.key.id ?? null;
      const chatJid = normaliseJid(update.key.remoteJid ?? (messageId ? this.messageIdToChatJid.get(messageId) ?? null : null));
      const ack = readNumericAck(update.update.status);

      if (!messageId || !chatJid || ack === null) {
        continue;
      }

      if (ack >= OBSERVED_ACK) {
        await this.ingestOutboundObservation({
          messageId,
          chatJid,
          source: 'baileys.messages.update',
        });
      }

      if (ack >= 2) {
        await this.ingestOutboundConfirmation({
          messageId,
          chatJid,
          ack,
          source: 'baileys.messages.update',
        });
      }
    }
  }

  async ingestContacts(contacts: readonly Contact[], now = new Date()): Promise<void> {
    if (!this.runtimeFlags.conversationDiscoveryEnabled) {
      return;
    }

    let changed = false;

    for (const contact of contacts) {
      const chatJid = normaliseJid(contact.id ?? contact.phoneNumber ?? null);
      const label = normaliseLabel(contact.name ?? contact.notify ?? contact.verifiedName ?? null);

      if (!chatJid || !label) {
        continue;
      }

      this.contactLabels.set(chatJid, label);
      const current = this.discoveredConversations.get(chatJid);

      if (current && current.displayName !== label) {
        this.discoveredConversations.set(chatJid, {
          ...current,
          displayName: label,
          updatedAt: now.toISOString(),
        });
        changed = true;
      }
    }

    if (changed) {
      await this.emitRuntimeEvent('conversations');
    }
  }

  async ingestMessageHistory(payload: {
    readonly chats?: readonly Chat[];
    readonly contacts?: readonly Contact[];
    readonly messages?: readonly WAMessage[];
  }): Promise<void> {
    if (payload.contacts) {
      await this.ingestContacts(payload.contacts);
    }

    if (payload.chats) {
      await this.ingestChatsUpsert(payload.chats);
    }

    if (payload.messages) {
      await this.ingestMessageUpsertBatch(payload.messages);
    }
  }

  private async ingestMessageUpsertBatch(messages: readonly WAMessage[]): Promise<void> {
    for (const message of messages) {
      const messageId = message.key?.id;
      const chatJid = normaliseJid(message.key?.remoteJid ?? null);

      if (messageId && chatJid) {
        this.messageIdToChatJid.set(messageId, chatJid);
      }

      if (this.runtimeFlags.conversationDiscoveryEnabled) {
        const mappedConversation = mapMessageToConversation(
          message,
          this.contactLabels,
          this.normalizer,
          new Date(),
        );

        if (mappedConversation) {
          this.upsertConversation(mappedConversation, new Date());
        }
      }

      if (!message.key?.fromMe) {
        const normalized = await this.ingestInboundEnvelope(message as unknown as RawBaileysMessageEnvelope);
        await this.ingestInboundMediaMessage(message, normalized);
      }
    }
  }

  private async ingestInboundMediaMessage(
    message: WAMessage,
    normalized?: NormalizedInboundMessage,
  ): Promise<void> {
    const messageId = message.key?.id?.trim();
    const chatJid = normaliseJid(message.key?.remoteJid ?? null);
    const descriptor = readInboundMediaDescriptor(message as unknown as RawBaileysMessageEnvelope);

    if (!messageId || !chatJid || !descriptor || this.seenInboundMediaMessageIds.has(messageId)) {
      return;
    }

    const binary = await this.downloadInboundMediaBinary(message).catch((error) => {
      console.warn(`Failed to download inbound media for ${messageId}.`, error);
      return null;
    });

    if (!binary || binary.byteLength === 0) {
      return;
    }

    const participantJid = normaliseJid(message.key?.participant ?? null) ?? chatJid;
    const timestamp = normalized?.timestamp ?? toIsoTimestamp(message.messageTimestamp ?? null) ?? new Date().toISOString();
    const payload: InboundMediaMessage = {
      messageId,
      chatJid,
      participantJid,
      ...(chatJid.endsWith('@g.us') ? { groupJid: chatJid } : {}),
      timestamp,
      ...(normaliseLabel(message.pushName ?? null) ? { pushName: normaliseLabel(message.pushName ?? null) ?? undefined } : {}),
      mediaType: descriptor.mediaType,
      mimeType: descriptor.mimeType,
      ...(descriptor.fileName ? { fileName: descriptor.fileName } : {}),
      caption: descriptor.caption,
      fileSize: descriptor.fileSize ?? binary.byteLength,
      durationSeconds: descriptor.durationSeconds,
      binary,
    };

    this.seenInboundMediaMessageIds.add(messageId);
    await this.emit(this.inboundMediaListeners, payload);
  }

  private async downloadInboundMediaBinary(message: WAMessage): Promise<Uint8Array | null> {
    const content = extractMessageContent(message.message);
    const rawMessage = message as unknown as RawBaileysMessageEnvelope;
    const embeddedBinary =
      toEmbeddedBinary(rawMessage.message?.imageMessage?.binary)
      ?? toEmbeddedBinary(rawMessage.message?.videoMessage?.binary)
      ?? toEmbeddedBinary(rawMessage.message?.documentMessage?.binary)
      ?? toEmbeddedBinary(rawMessage.message?.audioMessage?.binary);

    if (embeddedBinary) {
      return embeddedBinary;
    }

    if (!content || !readInboundMediaDescriptor(rawMessage)) {
      return null;
    }

    const socket = this.socket;
    return downloadMediaMessage(
      message,
      'buffer',
      {},
      socket?.updateMediaMessage
        ? {
            reuploadRequest: (value: WAMessage) => socket.updateMediaMessage!(value),
            logger: createSilentBaileysLogger(),
          }
        : undefined,
    );
  }

  private async ensureSocket(): Promise<void> {
    if (!this.startRequested || !this.runtimeFlags.enabled || this.socket || this.connectPromise) {
      return;
    }

    this.connectPromise = this.openSocket().finally(() => {
      this.connectPromise = undefined;
    });
    await this.connectPromise;
  }

  private async openSocket(): Promise<void> {
    const authPath = await this.sessionStore.ensureSessionDirectory(this.accountId);
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const latestVersion = await this.versionResolver()
      .then((value) => value.version)
      .catch(() => undefined);

    this.sessionSnapshot = {
      ...this.sessionSnapshot,
      phase: 'connecting',
      connected: false,
      lastError: null,
    };
    await this.emitRuntimeEvent('session');

    const socket = await this.socketFactory({
      authState: state,
      browser: Browsers.ubuntu(this.browserLabel),
      logger: createSilentBaileysLogger(),
      version: latestVersion,
    });

    this.attachSocket(socket, saveCreds);
  }

  private attachSocket(socket: BaileysSocketLike, saveCreds: () => Promise<void>): void {
    this.clearSocketReference();
    this.socket = socket;

    const listeners: Array<readonly [string, (value: any) => void]> = [
      [
        'connection.update',
        (value) => {
          void this.ingestConnectionUpdate(value as Partial<ConnectionState>);
        },
      ],
      [
        'creds.update',
        () => {
          void saveCreds();
        },
      ],
      [
        'messages.upsert',
        (value) => {
          const payload = value as {
            readonly messages?: readonly WAMessage[];
          };
          void this.ingestMessageUpsertBatch(payload.messages ?? []);
        },
      ],
      [
        'messages.update',
        (value) => {
          void this.ingestMessagesUpdate(value as readonly WAMessageUpdate[]);
        },
      ],
      [
        'messaging-history.set',
        (value) => {
          void this.ingestMessageHistory(value as {
            readonly chats?: readonly Chat[];
            readonly contacts?: readonly Contact[];
            readonly messages?: readonly WAMessage[];
          });
        },
      ],
      [
        'groups.upsert',
        (value) => {
          void this.ingestGroupsUpsert(value as readonly GroupMetadata[]);
        },
      ],
      [
        'groups.update',
        (value) => {
          void this.ingestGroupsUpsert(value as readonly GroupMetadata[]);
        },
      ],
      [
        'chats.upsert',
        (value) => {
          void this.ingestChatsUpsert(value as readonly Chat[]);
        },
      ],
      [
        'chats.update',
        (value) => {
          void this.ingestChatsUpsert(value as readonly Chat[]);
        },
      ],
      [
        'contacts.upsert',
        (value) => {
          void this.ingestContacts(value as readonly Contact[]);
        },
      ],
      [
        'contacts.update',
        (value) => {
          void this.ingestContacts(value as readonly Contact[]);
        },
      ],
    ];

    for (const [eventName, listener] of listeners) {
      socket.ev.on(eventName, listener);
      this.socketCleanups.push(() => {
        socket.ev.off(eventName, listener);
      });
    }
  }

  private async detachCurrentSocket(options: {
    readonly logout: boolean;
  }): Promise<void> {
    const socket = this.socket;
    this.clearSocketReference();

    if (!socket) {
      return;
    }

    try {
      if (options.logout) {
        await socket.logout('LumeHub session closed intentionally.');
        return;
      }

      socket.end(undefined);
    } catch {}
  }

  private clearSocketReference(): void {
    const cleanups = [...this.socketCleanups];
    this.socketCleanups = [];
    this.socket = undefined;

    for (const cleanup of cleanups) {
      cleanup();
    }
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
  }

  private scheduleReconnect(): void {
    if (!this.startRequested || this.stopRequested || !this.runtimeFlags.enabled || this.reconnectTimer) {
      return;
    }

    const delayMs = this.reconnectPolicy.nextDelayMs(this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.ensureSocket().catch(async (error) => {
        this.sessionSnapshot = {
          ...this.sessionSnapshot,
          phase: 'error',
          connected: false,
          lastError: readErrorMessage(error),
        };
        await this.emitRuntimeEvent('session');
        this.scheduleReconnect();
      });
    }, delayMs);
  }

  private async refreshSessionPresence(): Promise<void> {
    const sessionPresent = await this.sessionStore.hasSession(this.accountId);
    this.sessionSnapshot = {
      ...this.sessionSnapshot,
      sessionPresent,
      loginRequired: !sessionPresent && !this.sessionSnapshot.connected,
      phase: !this.runtimeFlags.enabled ? 'disabled' : this.sessionSnapshot.phase,
    };
  }

  private clearQrSnapshot(): void {
    this.qrSnapshot = {
      available: false,
      value: null,
      svg: null,
      updatedAt: null,
      expiresAt: null,
    };
  }

  private clearWorkspaceCache(): void {
    this.seenMessageIds.clear();
    this.semanticSeenAt.clear();
    this.messageIdToChatJid.clear();
    this.discoveredGroups.clear();
    this.discoveredConversations.clear();
    this.contactLabels.clear();
    this.seenInboundMediaMessageIds.clear();
  }

  private shouldReconnect(disconnectReason: number | null): boolean {
    if (!this.runtimeFlags.enabled || !this.startRequested || this.stopRequested) {
      return false;
    }

    return disconnectReason !== DisconnectReason.loggedOut && disconnectReason !== DisconnectReason.connectionReplaced;
  }

  private upsertConversation(
    input: {
      readonly chatJid: string;
      readonly displayName: string;
      readonly lastMessageAt: string | null;
      readonly lastMessagePreview: string | null;
      readonly unreadCount: number;
    },
    now = new Date(),
  ): void {
    const current = this.discoveredConversations.get(input.chatJid);
    const nextConversation: WhatsAppDiscoveredConversation = {
      chatJid: input.chatJid,
      displayName: input.displayName,
      lastMessageAt: input.lastMessageAt ?? current?.lastMessageAt ?? null,
      lastMessagePreview: input.lastMessagePreview ?? current?.lastMessagePreview ?? null,
      unreadCount: input.unreadCount,
      discoveredAt: current?.discoveredAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.discoveredConversations.set(input.chatJid, nextConversation);
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

  private async emitRuntimeEvent(topic: WhatsAppRuntimeEvent['topic']): Promise<void> {
    await this.emit(this.runtimeListeners, {
      topic,
      emittedAt: new Date().toISOString(),
      snapshot: await this.getRuntimeSnapshot(),
    });
  }

  private async emit<TValue>(listeners: Set<AsyncListener<TValue>>, value: TValue): Promise<void> {
    for (const listener of listeners) {
      await listener(value);
    }
  }
}

function buildOutboundMediaContent(input: WhatsAppSendMediaInput) {
  const binary = Buffer.from(input.binary);
  const caption = input.caption?.trim() || undefined;
  const fileName = input.fileName?.trim() || defaultFileNameForMedia(input.mediaType, input.mimeType);

  switch (input.mediaType) {
    case 'video':
      return {
        video: binary,
        mimetype: input.mimeType,
        caption,
      };
    case 'image':
      return {
        image: binary,
        mimetype: input.mimeType,
        caption,
      };
    case 'document':
      return {
        document: binary,
        mimetype: input.mimeType,
        caption,
        fileName,
      };
    case 'audio':
      return {
        audio: binary,
        mimetype: input.mimeType,
        ptt: false,
      };
  }
}

function defaultFileNameForMedia(mediaType: WhatsAppSendMediaInput['mediaType'], mimeType: string): string {
  const extension = extensionFromMimeType(mimeType);

  switch (mediaType) {
    case 'video':
      return `lumehub-video${extension}`;
    case 'image':
      return `lumehub-image${extension}`;
    case 'document':
      return `lumehub-document${extension}`;
    case 'audio':
      return `lumehub-audio${extension}`;
  }
}

function extensionFromMimeType(mimeType: string): string {
  switch (mimeType.trim().toLowerCase()) {
    case 'video/mp4':
      return '.mp4';
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'application/pdf':
      return '.pdf';
    case 'audio/mpeg':
      return '.mp3';
    case 'audio/ogg':
      return '.ogg';
    default: {
      const subtype = mimeType.split('/')[1]?.trim();
      return subtype ? `.${subtype.replace(/[^a-z0-9.+-]/gi, '')}` : '.bin';
    }
  }
}

async function defaultSocketFactory(input: BaileysSocketFactoryInput): Promise<BaileysSocketLike> {
  const config: UserFacingSocketConfig = {
    auth: input.authState,
    browser: [...input.browser],
    logger: input.logger as UserFacingSocketConfig['logger'],
    markOnlineOnConnect: false,
    syncFullHistory: false,
    printQRInTerminal: false,
    ...(input.version ? { version: [...input.version] } : {}),
  };
  return makeWASocket(config) as unknown as BaileysSocketLike;
}

function createSilentBaileysLogger(): BaileysLoggerLike {
  return {
    level: 'silent',
    child() {
      return createSilentBaileysLogger();
    },
    trace() {},
    debug() {},
    info() {},
    warn() {},
    error() {},
    fatal() {},
  };
}

function mapGroup(group: GroupMetadata, now: Date): WhatsAppDiscoveredGroup | null {
  const groupJid = normaliseJid(group.id ?? null);
  const subject = normaliseLabel(group.subject ?? null);

  if (!groupJid || !subject) {
    return null;
  }

  return {
    groupJid,
    subject,
    aliases: [],
    size: typeof group.size === 'number' ? group.size : null,
    participants: (group.participants ?? []).map((participant) => participant.id).filter(isNonEmptyString),
    discoveredAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function mapChat(
  chat: Chat,
  contactLabels: ReadonlyMap<string, string>,
  now: Date,
): WhatsAppDiscoveredConversation | null {
  const chatJid = normaliseJid((chat as { readonly id?: string | null }).id ?? null);

  if (!chatJid || isJidGroup(chatJid)) {
    return null;
  }

  return {
    chatJid,
    displayName:
      normaliseLabel((chat as { readonly name?: string | null }).name ?? null) ??
      contactLabels.get(chatJid) ??
      chatJid,
    lastMessageAt: toIsoTimestamp(
      (chat as { readonly conversationTimestamp?: number | string | null }).conversationTimestamp ??
        chat.lastMessageRecvTimestamp ??
        null,
    ),
    lastMessagePreview: null,
    unreadCount: readUnreadCount(chat),
    discoveredAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function mapMessageToConversation(
  message: WAMessage,
  contactLabels: ReadonlyMap<string, string>,
  normalizer: InboundMessageNormalizer,
  now: Date,
): {
  readonly chatJid: string;
  readonly displayName: string;
  readonly lastMessageAt: string | null;
  readonly lastMessagePreview: string | null;
  readonly unreadCount: number;
} | null {
  const chatJid = normaliseJid(message.key?.remoteJid ?? null);

  if (!chatJid || isJidGroup(chatJid)) {
    return null;
  }

  const normalized = normalizer.normalize(message as unknown as RawBaileysMessageEnvelope);

  return {
    chatJid,
    displayName: normaliseLabel(message.pushName ?? null) ?? contactLabels.get(chatJid) ?? chatJid,
    lastMessageAt: normalized?.timestamp ?? toIsoTimestamp(message.messageTimestamp ?? null),
    lastMessagePreview: normalized?.text ?? null,
    unreadCount: 0,
  };
}

function readDisconnectReason(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  if ('output' in error && error.output && typeof error.output === 'object') {
    const statusCode = (error.output as { readonly statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : null;
  }

  if ('statusCode' in error) {
    const statusCode = (error as { readonly statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : null;
  }

  return null;
}

function readErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  return error instanceof Error ? error.message : String(error);
}

function normaliseJid(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normaliseLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readNumericAck(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readInboundMediaDescriptor(
  payload: RawBaileysMessageEnvelope,
): {
  readonly mediaType: InboundMediaMessage['mediaType'];
  readonly mimeType: string;
  readonly fileName?: string;
  readonly caption: string | null;
  readonly fileSize: number | null;
  readonly durationSeconds: number | null;
} | null {
  const imageMessage = payload.message?.imageMessage;

  if (imageMessage) {
    return {
      mediaType: 'image',
      mimeType: normaliseMimeType(imageMessage.mimetype, 'image/*'),
      caption: normaliseOptionalString(imageMessage.caption),
      fileSize: readNumericLike(imageMessage.fileLength),
      durationSeconds: null,
    };
  }

  const videoMessage = payload.message?.videoMessage;

  if (videoMessage) {
    return {
      mediaType: 'video',
      mimeType: normaliseMimeType(videoMessage.mimetype, 'video/*'),
      caption: normaliseOptionalString(videoMessage.caption),
      fileSize: readNumericLike(videoMessage.fileLength),
      durationSeconds: typeof videoMessage.seconds === 'number' ? videoMessage.seconds : null,
    };
  }

  const documentMessage = payload.message?.documentMessage;

  if (documentMessage) {
    return {
      mediaType: 'document',
      mimeType: normaliseMimeType(documentMessage.mimetype, 'application/octet-stream'),
      fileName: normaliseOptionalString(documentMessage.fileName) ?? undefined,
      caption: normaliseOptionalString(documentMessage.caption),
      fileSize: readNumericLike(documentMessage.fileLength),
      durationSeconds: null,
    };
  }

  const audioMessage = payload.message?.audioMessage;

  if (audioMessage) {
    return {
      mediaType: 'audio',
      mimeType: normaliseMimeType(audioMessage.mimetype, 'audio/*'),
      caption: null,
      fileSize: readNumericLike(audioMessage.fileLength),
      durationSeconds: typeof audioMessage.seconds === 'number' ? audioMessage.seconds : null,
    };
  }

  return null;
}

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const numericValue = Number(value);

    if (Number.isFinite(numericValue)) {
      return new Date(numericValue * 1000).toISOString();
    }
  }

  if (value && typeof value === 'object' && 'low' in value) {
    const lowValue = (value as { readonly low?: unknown }).low;

    if (typeof lowValue === 'number' && Number.isFinite(lowValue)) {
      return new Date(lowValue * 1000).toISOString();
    }
  }

  return null;
}

function readNumericLike(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  if (typeof value === 'object' && value && 'low' in value) {
    const low = (value as { readonly low?: unknown }).low;
    return typeof low === 'number' && Number.isFinite(low) ? low : null;
  }

  return null;
}

function normaliseOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normaliseMimeType(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function toEmbeddedBinary(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (Array.isArray(value) && value.every((entry) => typeof entry === 'number')) {
    return Uint8Array.from(value);
  }

  return null;
}

function readUnreadCount(chat: Chat): number {
  const value = (chat as { readonly unreadCount?: unknown }).unreadCount;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function buildInboundNormalizeFailureSummary(payload: RawBaileysMessageEnvelope): Record<string, unknown> {
  const { leafMessage, wrapperChain } = unwrapMessageForDebug(payload.message);

  return {
    messageId: payload.key?.id?.trim() || null,
    chatJid: payload.key?.remoteJid?.trim() || null,
    participantJid: payload.key?.participant?.trim() || null,
    fromMe: payload.key?.fromMe ?? false,
    topLevelKeys: listOwnKeys(payload.message),
    wrapperChain,
    leafKeys: listOwnKeys(leafMessage),
    conversationText: readConversationText(payload.message),
    extendedText: readExtendedText(payload.message),
    leafConversationText: readConversationText(leafMessage),
    leafExtendedText: readExtendedText(leafMessage),
    topLevelMentions: readMentionedJids(payload.message),
    leafMentions: readMentionedJids(leafMessage),
  };
}

function unwrapMessageForDebug(
  message: RawBaileysMessageEnvelope['message'],
): {
  readonly leafMessage: Record<string, unknown> | null;
  readonly wrapperChain: readonly string[];
} {
  let current = asRecord(message);
  const wrapperChain: string[] = [];

  for (let index = 0; index < RAW_MESSAGE_WRAPPER_KEYS.length && current; index += 1) {
    const wrapperKey = RAW_MESSAGE_WRAPPER_KEYS.find((key) => {
      const wrapper = asRecord(current?.[key]);
      return asRecord(wrapper?.message) !== null;
    });

    if (!wrapperKey) {
      break;
    }

    wrapperChain.push(wrapperKey);
    current = asRecord(asRecord(current[wrapperKey])?.message);
  }

  return {
    leafMessage: current,
    wrapperChain,
  };
}

function listOwnKeys(value: unknown): readonly string[] {
  const record = asRecord(value);
  return record ? Object.keys(record) : [];
}

function readConversationText(value: unknown): string | null {
  const record = asRecord(value);
  return typeof record?.conversation === 'string' && record.conversation.trim()
    ? record.conversation.trim()
    : null;
}

function readExtendedText(value: unknown): string | null {
  const record = asRecord(value);
  const extendedTextMessage = asRecord(record?.extendedTextMessage);

  return typeof extendedTextMessage?.text === 'string' && extendedTextMessage.text.trim()
    ? extendedTextMessage.text.trim()
    : null;
}

function readMentionedJids(value: unknown): readonly string[] {
  const record = asRecord(value);
  const candidates = [
    asRecord(asRecord(record?.extendedTextMessage)?.contextInfo),
    asRecord(record?.messageContextInfo),
    asRecord(asRecord(record?.imageMessage)?.contextInfo),
    asRecord(asRecord(record?.videoMessage)?.contextInfo),
    asRecord(asRecord(record?.documentMessage)?.contextInfo),
    asRecord(asRecord(record?.audioMessage)?.contextInfo),
  ];

  for (const candidate of candidates) {
    const mentioned = candidate?.mentionedJid;

    if (Array.isArray(mentioned)) {
      return mentioned.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    }
  }

  return [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
