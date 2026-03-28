import { DEFAULT_ADMIN_SETTINGS, type AdminConfigModuleContract, type WhatsAppSettings } from '@lume-hub/admin-config';
import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { MediaLibraryModuleContract } from '@lume-hub/media-library';
import type { PeopleMemoryModuleContract } from '@lume-hub/people-memory';
import type {
  BaileysWhatsAppGateway,
  InboundMediaMessage,
  WhatsAppRuntimeEvent,
  WhatsAppRuntimeSnapshot,
  WhatsAppSendMediaInput,
  WhatsAppSendResult,
  WhatsAppSendTextInput,
} from '@lume-hub/whatsapp-baileys';

interface UiEventPublisherLike {
  publish<TPayload>(topic: string, payload: TPayload, now?: Date): {
    readonly eventId: string;
    readonly topic: string;
    readonly emittedAt: string;
    readonly payload: TPayload;
  };
}

export interface WhatsAppWorkspaceRuntimeConfig {
  readonly gateway: BaileysWhatsAppGateway;
  readonly adminConfig: Pick<AdminConfigModuleContract, 'getSettings'>;
  readonly groupDirectory: Pick<GroupDirectoryModuleContract, 'refreshFromWhatsApp'>;
  readonly mediaLibrary?: Pick<MediaLibraryModuleContract, 'ingestAsset'>;
  readonly peopleMemory?: Pick<PeopleMemoryModuleContract, 'upsertByIdentifiers'>;
  readonly uiEventPublisher?: UiEventPublisherLike;
}

export class WhatsAppWorkspaceRuntime {
  private started = false;
  private detachRuntimeListener?: () => void;
  private detachInboundMediaListener?: () => void;
  private lastGroupFingerprint: string | null = null;
  private lastConversationFingerprint: string | null = null;

  constructor(private readonly config: WhatsAppWorkspaceRuntimeConfig) {}

  get gateway(): BaileysWhatsAppGateway {
    return this.config.gateway;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    this.detachRuntimeListener = this.config.gateway.subscribeRuntime((event) => {
      void this.handleRuntimeEvent(event);
    });
    this.detachInboundMediaListener = this.config.gateway.subscribeInboundMedia((message) => {
      void this.handleInboundMedia(message);
    });
    await this.applySettings(await this.readWhatsAppSettings());
    await this.config.gateway.start();
    await this.refreshWorkspace();
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.detachRuntimeListener?.();
    this.detachRuntimeListener = undefined;
    this.detachInboundMediaListener?.();
    this.detachInboundMediaListener = undefined;
    await this.config.gateway.stop();
  }

  async refreshWorkspace(): Promise<WhatsAppRuntimeSnapshot> {
    const snapshot = await this.config.gateway.refreshWorkspace();
    await this.syncDiscoveredWorkspace(snapshot);
    this.publish('whatsapp.workspace.refreshed', snapshot);
    return snapshot;
  }

  async getRuntimeSnapshot(): Promise<WhatsAppRuntimeSnapshot> {
    return this.config.gateway.getRuntimeSnapshot();
  }

  async sendText(input: WhatsAppSendTextInput): Promise<WhatsAppSendResult> {
    return this.config.gateway.sendText(input);
  }

  async sendMedia(input: WhatsAppSendMediaInput): Promise<WhatsAppSendResult> {
    return this.config.gateway.sendMedia(input);
  }

  async applySettings(settings: Partial<WhatsAppSettings>): Promise<WhatsAppRuntimeSnapshot> {
    const normalised = normaliseWhatsAppSettings(settings);
    const snapshot = await this.config.gateway.applyRuntimeFlags({
      enabled: normalised.enabled,
      groupDiscoveryEnabled: normalised.groupDiscoveryEnabled,
      conversationDiscoveryEnabled: normalised.conversationDiscoveryEnabled,
    });
    await this.syncDiscoveredWorkspace(snapshot);
    this.publish('whatsapp.settings.applied', {
      settings: normalised,
      runtime: snapshot,
    });
    return snapshot;
  }

  private async handleRuntimeEvent(event: WhatsAppRuntimeEvent): Promise<void> {
    await this.syncDiscoveredWorkspace(event.snapshot);
    this.publish(`whatsapp.${event.topic}.updated`, event.snapshot);
    this.publish('whatsapp.runtime.updated', event.snapshot);
  }

  private async handleInboundMedia(message: InboundMediaMessage): Promise<void> {
    if (!this.config.mediaLibrary) {
      return;
    }

    const ingestResult = await this.config.mediaLibrary.ingestAsset({
      mediaType: message.mediaType,
      mimeType: message.mimeType,
      binary: message.binary,
      sourceChatJid: message.chatJid,
      sourceMessageId: message.messageId,
      caption: message.caption,
      storedAt: message.timestamp,
    });

    this.publish('media.asset.ingested', {
      assetId: ingestResult.asset.assetId,
      mediaType: ingestResult.asset.mediaType,
      sourceChatJid: ingestResult.asset.sourceChatJid,
      sourceMessageId: ingestResult.asset.sourceMessageId,
      deduplicated: ingestResult.deduplicated,
      caption: ingestResult.asset.caption,
      storedAt: ingestResult.asset.storedAt,
    });
    this.publish('whatsapp.media.received', {
      assetId: ingestResult.asset.assetId,
      sourceChatJid: message.chatJid,
      sourceMessageId: message.messageId,
      mediaType: message.mediaType,
    });
  }

  private async syncDiscoveredWorkspace(snapshot: WhatsAppRuntimeSnapshot): Promise<void> {
    if (snapshot.flags.groupDiscoveryEnabled) {
      const fingerprint = snapshot.groups
        .map((group) => `${group.groupJid}:${group.subject}:${group.updatedAt}`)
        .join('|');

      if (fingerprint !== this.lastGroupFingerprint && snapshot.groups.length > 0) {
        await this.config.groupDirectory.refreshFromWhatsApp(
          snapshot.groups.map((group) => ({
            groupJid: group.groupJid,
            subject: group.subject,
            aliases: group.aliases,
          })),
        );
        this.lastGroupFingerprint = fingerprint;
      }
    }

    if (snapshot.flags.conversationDiscoveryEnabled && this.config.peopleMemory) {
      const fingerprint = snapshot.conversations
        .map((conversation) => `${conversation.chatJid}:${conversation.displayName}:${conversation.updatedAt}`)
        .join('|');

      if (fingerprint !== this.lastConversationFingerprint && snapshot.conversations.length > 0) {
        for (const conversation of snapshot.conversations) {
          await this.config.peopleMemory.upsertByIdentifiers({
            displayName: conversation.displayName,
            identifiers: [
              {
                kind: 'whatsapp_jid',
                value: conversation.chatJid,
              },
            ],
            globalRoles: ['member'],
          });
        }

        this.lastConversationFingerprint = fingerprint;
      }
    }
  }

  private async readWhatsAppSettings(): Promise<WhatsAppSettings> {
    const settings = await this.config.adminConfig.getSettings();
    return normaliseWhatsAppSettings(settings.whatsapp);
  }

  private publish(topic: string, payload: unknown): void {
    this.config.uiEventPublisher?.publish(topic, payload);
  }
}

function normaliseWhatsAppSettings(input: Partial<WhatsAppSettings> | undefined): WhatsAppSettings {
  return {
    enabled: input?.enabled ?? DEFAULT_ADMIN_SETTINGS.whatsapp.enabled,
    sharedAuthWithCodex: input?.sharedAuthWithCodex ?? DEFAULT_ADMIN_SETTINGS.whatsapp.sharedAuthWithCodex,
    groupDiscoveryEnabled: input?.groupDiscoveryEnabled ?? DEFAULT_ADMIN_SETTINGS.whatsapp.groupDiscoveryEnabled,
    conversationDiscoveryEnabled:
      input?.conversationDiscoveryEnabled ?? DEFAULT_ADMIN_SETTINGS.whatsapp.conversationDiscoveryEnabled,
  };
}
