import { randomUUID } from 'node:crypto';

import type { AssistantContextModuleContract } from '@lume-hub/assistant-context';
import type { ConversationModuleContract } from '@lume-hub/conversation';
import type { PeopleMemoryModuleContract, Person } from '@lume-hub/people-memory';
import type {
  IOutboundSignalSource,
  NormalizedInboundMessage,
  OutboundConfirmationSignal,
  OutboundObservationSignal,
} from '@lume-hub/whatsapp-baileys';

import type { ConversationReplyDeliveryRepository } from './ConversationReplyDeliveryRepository.js';

const DEFAULT_MAX_INBOUND_AGE_MS = 180_000;

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
  readonly assistantContext: Pick<AssistantContextModuleContract, 'recordMessage'>;
  readonly peopleMemory: Pick<PeopleMemoryModuleContract, 'findByIdentifiers' | 'upsertByIdentifiers'>;
  readonly conversation: Pick<ConversationModuleContract, 'handleIncomingMessage'>;
  readonly outboundSignalSource?: Pick<
    IOutboundSignalSource,
    'subscribeOutboundObservation' | 'subscribeOutboundConfirmation'
  >;
  readonly replyDeliveryRepository?: Pick<
    ConversationReplyDeliveryRepository,
    | 'markAccepted'
    | 'markArmed'
    | 'markConfirmedByOutboundMessageId'
    | 'markFailed'
    | 'markObservedByOutboundMessageId'
  >;
  readonly maxInboundAgeMs?: number;
  readonly uiEventPublisher?: UiEventPublisherLike;
}

export class ConversationPipelineRuntime {
  private started = false;
  private detachInboundListener?: () => void;
  private detachObservationListener?: () => void;
  private detachConfirmationListener?: () => void;

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
    this.detachObservationListener = this.config.outboundSignalSource?.subscribeOutboundObservation((signal) => {
      void this.handleObservation(signal).catch(() => undefined);
    });
    this.detachConfirmationListener = this.config.outboundSignalSource?.subscribeOutboundConfirmation((signal) => {
      void this.handleConfirmation(signal).catch(() => undefined);
    });
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.detachInboundListener?.();
    this.detachInboundListener = undefined;
    this.detachObservationListener?.();
    this.detachObservationListener = undefined;
    this.detachConfirmationListener?.();
    this.detachConfirmationListener = undefined;
  }

  private async handleInbound(message: NormalizedInboundMessage): Promise<void> {
    const runtimeSnapshot = await this.config.whatsAppRuntime.getRuntimeSnapshot();
    const inboundDecision = evaluateInboundProcessing(message, runtimeSnapshot.session.selfJid, new Date(), this.config.maxInboundAgeMs);

    if (!inboundDecision.accepted) {
      this.publish('conversation.inbound.ignored', {
        messageId: message.messageId,
        chatJid: message.chatJid,
        groupJid: message.groupJid ?? null,
        reason: inboundDecision.reason,
        ageMs: inboundDecision.ageMs,
        wasTagged: inboundDecision.wasTagged,
        isReplyToBot: inboundDecision.isReplyToBot,
      });
      return;
    }

    const person = await this.resolvePerson(message);
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
      wasTagged: inboundDecision.wasTagged,
      isReplyToBot: inboundDecision.isReplyToBot,
      allowActions: true,
    };

    await this.config.assistantContext.recordMessage({
      messageId: input.messageId,
      chatJid: input.chatJid,
      chatType: input.chatType,
      groupJid: input.groupJid,
      personId: input.personId,
      senderDisplayName: input.senderDisplayName,
      role: 'user',
      text: input.text,
    });

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
      memoryUsage: generatedReply.agentResult.memoryUsage,
      schedulingInsight: generatedReply.agentResult.schedulingInsight,
    });

    if (!generatedReply.shouldReply || !generatedReply.replyText || !generatedReply.targetChatJid) {
      return;
    }

    const replyId = `conversation-reply-${randomUUID()}`;
    const nowIso = new Date().toISOString();
    await this.config.replyDeliveryRepository?.markArmed({
      replyId,
      sourceMessageId: message.messageId,
      sourceChatJid: message.chatJid,
      sourceChatType: message.groupJid ? 'group' : 'private',
      sourceGroupJid: message.groupJid ?? null,
      sourcePersonId: person.personId,
      targetChatJid: generatedReply.targetChatJid,
      targetChatType: generatedReply.targetChatType ?? (message.groupJid ? 'group' : 'private'),
      replyText: generatedReply.replyText,
      reason: generatedReply.reason,
      armedAt: nowIso,
    });
    this.publish('conversation.reply.armed', {
      replyId,
      sourceMessageId: message.messageId,
      targetChatJid: generatedReply.targetChatJid,
      targetChatType: generatedReply.targetChatType,
      reason: generatedReply.reason,
    });

    let sendResult: Awaited<ReturnType<WhatsAppReplyRuntimeLike['sendText']>>;

    try {
      sendResult = await this.config.whatsAppRuntime.sendText({
        chatJid: generatedReply.targetChatJid,
        text: generatedReply.replyText,
        idempotencyKey: message.messageId,
        messageId: `reply-${message.messageId}`,
      });
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      await this.config.replyDeliveryRepository?.markFailed(replyId, {
        failedAt: new Date().toISOString(),
        error: errorMessage,
      });
      throw error;
    }

    await this.config.replyDeliveryRepository?.markAccepted(replyId, {
      outboundMessageId: sendResult.messageId,
      acceptedAt: sendResult.acceptedAt,
    });
    await this.config.assistantContext.recordMessage({
      messageId: sendResult.messageId,
      chatJid: generatedReply.targetChatJid,
      chatType: generatedReply.targetChatType ?? (message.groupJid ? 'group' : 'private'),
      groupJid: (generatedReply.targetChatType ?? (message.groupJid ? 'group' : 'private')) === 'group'
        ? generatedReply.targetChatJid
        : null,
      personId: input.personId,
      senderDisplayName: 'LumeHub',
      role: 'assistant',
      text: generatedReply.replyText,
    });

    this.publish('conversation.reply.accepted', {
      replyId,
      sourceMessageId: message.messageId,
      targetChatJid: generatedReply.targetChatJid,
      targetChatType: generatedReply.targetChatType,
      replyText: generatedReply.replyText,
      sendResult,
    });
  }

  private async handleObservation(signal: OutboundObservationSignal): Promise<void> {
    const updated = await this.config.replyDeliveryRepository?.markObservedByOutboundMessageId(signal.messageId, {
      observedAt: signal.observedAt,
    });

    if (!updated) {
      return;
    }

    this.publish('conversation.reply.observed', {
      replyId: updated.replyId,
      outboundMessageId: signal.messageId,
      targetChatJid: signal.chatJid,
      observedAt: signal.observedAt,
      source: signal.source,
    });
  }

  private async handleConfirmation(signal: OutboundConfirmationSignal): Promise<void> {
    const updated = await this.config.replyDeliveryRepository?.markConfirmedByOutboundMessageId(signal.messageId, {
      confirmedAt: signal.confirmedAt,
      ack: signal.ack,
    });

    if (!updated) {
      return;
    }

    this.publish('conversation.reply.confirmed', {
      replyId: updated.replyId,
      outboundMessageId: signal.messageId,
      targetChatJid: signal.chatJid,
      confirmedAt: signal.confirmedAt,
      ack: signal.ack,
      source: signal.source,
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

function evaluateInboundProcessing(
  message: NormalizedInboundMessage,
  selfJid: string | null,
  now: Date,
  maxInboundAgeMs = DEFAULT_MAX_INBOUND_AGE_MS,
): {
  readonly accepted: boolean;
  readonly reason: string | null;
  readonly ageMs: number;
  readonly wasTagged: boolean;
  readonly isReplyToBot: boolean;
} {
  const wasTagged = matchesOwnJid(message.mentionedJids, selfJid);
  const isReplyToBot = message.quotedParticipantJid ? sameJid(message.quotedParticipantJid, selfJid) : false;
  const ageMs = Math.max(0, now.getTime() - Date.parse(message.timestamp));
  const safeMaxInboundAgeMs = Number.isFinite(maxInboundAgeMs) && maxInboundAgeMs > 0
    ? Math.trunc(maxInboundAgeMs)
    : DEFAULT_MAX_INBOUND_AGE_MS;

  if (Number.isFinite(ageMs) && ageMs > safeMaxInboundAgeMs) {
    return {
      accepted: false,
      reason: 'stale_message',
      ageMs,
      wasTagged,
      isReplyToBot,
    };
  }

  if (message.groupJid && !wasTagged) {
    return {
      accepted: false,
      reason: isReplyToBot ? 'group_reply_requires_tag_even_in_thread' : 'group_reply_requires_tag',
      ageMs,
      wasTagged,
      isReplyToBot,
    };
  }

  return {
    accepted: true,
    reason: null,
    ageMs,
    wasTagged,
    isReplyToBot,
  };
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
