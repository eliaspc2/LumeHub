import type { ConversationModuleContract } from '@lume-hub/conversation';
import type { PeopleMemoryModuleContract, Person } from '@lume-hub/people-memory';
import type { NormalizedInboundMessage } from '@lume-hub/whatsapp-baileys';

interface UiEventPublisherLike {
  publish<TPayload>(topic: string, payload: TPayload, now?: Date): {
    readonly eventId: string;
    readonly topic: string;
    readonly emittedAt: string;
    readonly payload: TPayload;
  };
}

interface WhatsAppInboundSourceLike {
  subscribeInbound(listener: (message: NormalizedInboundMessage) => void | Promise<void>): () => void;
}

interface WhatsAppReplyRuntimeLike {
  getRuntimeSnapshot(): Promise<{
    readonly session: {
      readonly selfJid: string | null;
    };
  }>;
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
}

export interface ConversationPipelineRuntimeConfig {
  readonly inboundSource: WhatsAppInboundSourceLike;
  readonly whatsAppRuntime: WhatsAppReplyRuntimeLike;
  readonly peopleMemory: Pick<PeopleMemoryModuleContract, 'findByIdentifiers' | 'upsertByIdentifiers'>;
  readonly conversation: Pick<ConversationModuleContract, 'handleIncomingMessage'>;
  readonly uiEventPublisher?: UiEventPublisherLike;
}

export class ConversationPipelineRuntime {
  private started = false;
  private detachInboundListener?: () => void;

  constructor(private readonly config: ConversationPipelineRuntimeConfig) {}

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    this.detachInboundListener = this.config.inboundSource.subscribeInbound((message) => {
      void this.handleInbound(message).catch((error) => {
        this.publish('conversation.reply.failed', {
          messageId: message.messageId,
          chatJid: message.chatJid,
          error: toErrorMessage(error),
        });
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.detachInboundListener?.();
    this.detachInboundListener = undefined;
  }

  private async handleInbound(message: NormalizedInboundMessage): Promise<void> {
    const person = await this.resolvePerson(message);
    const runtimeSnapshot = await this.config.whatsAppRuntime.getRuntimeSnapshot();
    const input = {
      messageId: message.messageId,
      chatJid: message.chatJid,
      chatType: message.groupJid ? ('group' as const) : ('private' as const),
      groupJid: message.groupJid ?? null,
      personId: person.personId,
      senderDisplayName: person.displayName,
      text: message.text,
      identifiers: [
        {
          kind: 'whatsapp_jid',
          value: message.participantJid,
        },
      ],
      privateReplyJid: message.groupJid ? message.participantJid : null,
      wasTagged: matchesOwnJid(message.mentionedJids, runtimeSnapshot.session.selfJid),
      isReplyToBot: message.quotedParticipantJid ? sameJid(message.quotedParticipantJid, runtimeSnapshot.session.selfJid) : false,
      allowActions: true,
    };

    this.publish('conversation.inbound.received', {
      messageId: message.messageId,
      chatJid: message.chatJid,
      personId: person.personId,
      groupJid: message.groupJid ?? null,
      text: message.text,
    });

    const generatedReply = await this.config.conversation.handleIncomingMessage(input);
    this.publish('conversation.reply.generated', {
      messageId: message.messageId,
      chatJid: message.chatJid,
      personId: person.personId,
      shouldReply: generatedReply.shouldReply,
      reason: generatedReply.reason,
      targetChatJid: generatedReply.targetChatJid,
      targetChatType: generatedReply.targetChatType,
      replyText: generatedReply.replyText,
      auditId: generatedReply.auditId,
    });

    if (!generatedReply.shouldReply || !generatedReply.replyText || !generatedReply.targetChatJid) {
      return;
    }

    const sendResult = await this.config.whatsAppRuntime.sendText({
      chatJid: generatedReply.targetChatJid,
      text: generatedReply.replyText,
      idempotencyKey: message.messageId,
      messageId: `reply-${message.messageId}`,
    });

    this.publish('conversation.reply.accepted', {
      sourceMessageId: message.messageId,
      targetChatJid: generatedReply.targetChatJid,
      targetChatType: generatedReply.targetChatType,
      replyText: generatedReply.replyText,
      sendResult,
    });
  }

  private async resolvePerson(message: NormalizedInboundMessage): Promise<Person> {
    const identifiers = [
      {
        kind: 'whatsapp_jid',
        value: message.participantJid,
      },
    ] as const;

    const existingPerson = await this.config.peopleMemory.findByIdentifiers(identifiers);

    return this.config.peopleMemory.upsertByIdentifiers({
      personId: existingPerson?.personId,
      displayName: message.pushName?.trim() || existingPerson?.displayName || message.participantJid,
      identifiers,
      globalRoles: existingPerson?.globalRoles,
    });
  }

  private publish(topic: string, payload: unknown): void {
    this.config.uiEventPublisher?.publish(topic, payload);
  }
}

function matchesOwnJid(mentionedJids: readonly string[] | undefined, selfJid: string | null): boolean {
  return (mentionedJids ?? []).some((candidate) => sameJid(candidate, selfJid));
}

function sameJid(left: string | null | undefined, right: string | null | undefined): boolean {
  return normaliseJid(left) !== null && normaliseJid(left) === normaliseJid(right);
}

function normaliseJid(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
