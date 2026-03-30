import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
const { ConversationPipelineRuntime } = await import(
  '../../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/ConversationPipelineRuntime.js'
);

class FakeInboundSource {
  #listeners = new Set();

  subscribeInbound(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async emit(message) {
    for (const listener of this.#listeners) {
      await listener(message);
    }
  }
}

class FakeOutboundSignalSource {
  #observationListeners = new Set();
  #confirmationListeners = new Set();

  subscribeOutboundObservation(listener) {
    this.#observationListeners.add(listener);
    return () => this.#observationListeners.delete(listener);
  }

  subscribeOutboundConfirmation(listener) {
    this.#confirmationListeners.add(listener);
    return () => this.#confirmationListeners.delete(listener);
  }

  async emitObservation(signal) {
    for (const listener of this.#observationListeners) {
      await listener(signal);
    }
  }

  async emitConfirmation(signal) {
    for (const listener of this.#confirmationListeners) {
      await listener(signal);
    }
  }
}

class InMemoryReplyDeliveryRepository {
  entries = [];

  async markArmed(input) {
    const record = {
      ...input,
      state: 'armed',
      outboundMessageId: null,
      acceptedAt: null,
      observedAt: null,
      confirmedAt: null,
      failedAt: null,
      ack: null,
      lastError: null,
      updatedAt: input.armedAt,
    };
    this.entries.push(record);
    return record;
  }

  async markAccepted(replyId, input) {
    return this.#update(
      (entry) => entry.replyId === replyId,
      (entry) => ({
        ...entry,
        state: 'accepted',
        outboundMessageId: input.outboundMessageId,
        acceptedAt: input.acceptedAt,
        updatedAt: input.acceptedAt,
      }),
    );
  }

  async markObservedByOutboundMessageId(outboundMessageId, input) {
    return this.#update(
      (entry) => entry.outboundMessageId === outboundMessageId,
      (entry) => ({
        ...entry,
        state: entry.confirmedAt ? 'confirmed' : 'observed',
        observedAt: entry.observedAt ?? input.observedAt,
        updatedAt: input.observedAt,
      }),
    );
  }

  async markConfirmedByOutboundMessageId(outboundMessageId, input) {
    return this.#update(
      (entry) => entry.outboundMessageId === outboundMessageId,
      (entry) => ({
        ...entry,
        state: 'confirmed',
        observedAt: entry.observedAt ?? input.confirmedAt,
        confirmedAt: input.confirmedAt,
        ack: input.ack,
        updatedAt: input.confirmedAt,
      }),
    );
  }

  async markFailed(replyId, input) {
    return this.#update(
      (entry) => entry.replyId === replyId,
      (entry) => ({
        ...entry,
        state: 'failed',
        failedAt: input.failedAt,
        lastError: input.error,
        updatedAt: input.failedAt,
      }),
    );
  }

  async read() {
    return {
      schemaVersion: 1,
      entries: this.entries,
    };
  }

  async #update(predicate, updater) {
    const index = this.entries.findIndex(predicate);
    if (index < 0) {
      return undefined;
    }

    this.entries[index] = updater(this.entries[index]);
    return this.entries[index];
  }
}

async function waitFor(assertion, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      assertion();
      return;
    } catch {
      await delay(10);
    }
  }

  assertion();
}

test('conversation pipeline matches WA-notify group gating: tag or reply to bot, but never stale backlog', async () => {
  const inboundSource = new FakeInboundSource();
  const outboundSignalSource = new FakeOutboundSignalSource();
  const replyDeliveryRepository = new InMemoryReplyDeliveryRepository();
  const recordedMessages = [];
  const conversationCalls = [];
  const sentMessages = [];

  const runtime = new ConversationPipelineRuntime({
    inboundSource,
    outboundSignalSource,
    replyDeliveryRepository,
    assistantContext: {
      async recordMessage(input) {
        recordedMessages.push(input);
      },
    },
    whatsAppRuntime: {
      async getRuntimeSnapshot() {
        return {
          session: {
            selfJid: '351910000099@s.whatsapp.net',
          },
        };
      },
      async sendText(input) {
        const acceptedAt = new Date().toISOString();
        const result = {
          messageId: `wamid.reply.${sentMessages.length + 1}`,
          chatJid: input.chatJid,
          acceptedAt,
          idempotencyKey: input.idempotencyKey,
        };
        sentMessages.push({
          ...input,
          acceptedAt,
          messageId: result.messageId,
        });
        return result;
      },
    },
    peopleMemory: {
      async findByIdentifiers() {
        return undefined;
      },
      async upsertByIdentifiers(input) {
        return {
          personId: 'person-ana',
          displayName: input.displayName,
          identifiers: input.identifiers,
          globalRoles: input.globalRoles ?? [],
        };
      },
    },
    conversation: {
      async handleIncomingMessage(input) {
        conversationCalls.push(input);
        return {
          shouldReply: true,
          replyText: 'Resposta fresca e controlada.',
          targetChatType: 'group',
          targetChatJid: input.chatJid,
          reason: null,
          auditId: 'conversation-audit-1',
          agentResult: {
            plan: {
              intent: 'casual_chat',
              selectedTools: ['chat_reply'],
              allowReply: true,
              replyMode: 'same_chat',
              notes: [],
            },
            session: {
              classification: {
                intent: 'casual_chat',
              },
              policyContext: {},
              assistantAllowed: true,
              chatContext: {},
              schedulingContext: null,
            },
            memoryUsage: {
              scope: 'none',
              groupJid: null,
              groupLabel: null,
              instructionsSource: null,
              instructionsApplied: false,
              knowledgeSnippetCount: 0,
              knowledgeDocuments: [],
            },
            schedulingInsight: null,
            scheduleApplyPreview: null,
            scheduleApplyResult: null,
            toolResults: [],
            replyText: 'Resposta fresca e controlada.',
            distributionPlan: null,
            enqueuedInstruction: null,
            ownerCommandResult: null,
            scheduleParseResult: null,
            llmChatResult: null,
          },
        };
      },
    },
  });

  try {
    await runtime.start();

    await inboundSource.emit({
      messageId: 'wamid.old.001',
      chatJid: '120363400000000001@g.us',
      participantJid: '351910000001@s.whatsapp.net',
      groupJid: '120363400000000001@g.us',
      fromMe: false,
      text: 'Lume, responde ao recado antigo.',
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      semanticFingerprint: 'old-message',
      pushName: 'Ana',
      mentionedJids: ['351910000099@s.whatsapp.net'],
    });

    await inboundSource.emit({
      messageId: 'wamid.group.untagged',
      chatJid: '120363400000000001@g.us',
      participantJid: '351910000001@s.whatsapp.net',
      groupJid: '120363400000000001@g.us',
      fromMe: false,
      text: 'Sem tag, nao devia responder.',
      timestamp: new Date().toISOString(),
      semanticFingerprint: 'fresh-untagged',
      pushName: 'Ana',
      mentionedJids: [],
    });

    await inboundSource.emit({
      messageId: 'wamid.group.tagged',
      chatJid: '120363400000000001@g.us',
      participantJid: '351910000001@s.whatsapp.net',
      groupJid: '120363400000000001@g.us',
      fromMe: false,
      text: '@LumeHub confirma a mudanca de sala.',
      timestamp: new Date().toISOString(),
      semanticFingerprint: 'fresh-tagged',
      pushName: 'Ana',
      mentionedJids: ['351910000099@s.whatsapp.net'],
    });

    await inboundSource.emit({
      messageId: 'wamid.group.reply-to-bot',
      chatJid: '120363400000000001@g.us',
      participantJid: '351910000001@s.whatsapp.net',
      groupJid: '120363400000000001@g.us',
      fromMe: false,
      text: 'Sem tag, mas a responder a uma mensagem tua.',
      timestamp: new Date().toISOString(),
      semanticFingerprint: 'fresh-reply-to-bot',
      pushName: 'Ana',
      mentionedJids: [],
      quotedParticipantJid: '351910000099@s.whatsapp.net',
    });

    await waitFor(() => {
      assert.equal(conversationCalls.length, 2);
      assert.equal(sentMessages.length, 2);
      assert.equal(recordedMessages.length, 4);
    });

    assert.equal(sentMessages[0].chatJid, '120363400000000001@g.us');
    assert.equal(sentMessages[1].chatJid, '120363400000000001@g.us');
    assert.deepEqual(
      recordedMessages.map((entry) => entry.role).sort(),
      ['assistant', 'assistant', 'user', 'user'],
    );

    await outboundSignalSource.emitObservation({
      messageId: sentMessages[0].messageId,
      chatJid: sentMessages[0].chatJid,
      observedAt: new Date().toISOString(),
      source: 'test.observation',
    });
    await outboundSignalSource.emitConfirmation({
      messageId: sentMessages[0].messageId,
      chatJid: sentMessages[0].chatJid,
      confirmedAt: new Date().toISOString(),
      source: 'test.confirmation',
      ack: 2,
    });
    await outboundSignalSource.emitObservation({
      messageId: sentMessages[1].messageId,
      chatJid: sentMessages[1].chatJid,
      observedAt: new Date().toISOString(),
      source: 'test.observation',
    });
    await outboundSignalSource.emitConfirmation({
      messageId: sentMessages[1].messageId,
      chatJid: sentMessages[1].chatJid,
      confirmedAt: new Date().toISOString(),
      source: 'test.confirmation',
      ack: 2,
    });

    const deliveryLog = await replyDeliveryRepository.read();
    assert.equal(deliveryLog.entries.length, 2);
    assert.equal(deliveryLog.entries[0].sourceMessageId, 'wamid.group.tagged');
    assert.equal(deliveryLog.entries[0].state, 'confirmed');
    assert.equal(deliveryLog.entries[0].outboundMessageId, sentMessages[0].messageId);
    assert.equal(deliveryLog.entries[0].targetChatType, 'group');
    assert.equal(deliveryLog.entries[0].ack, 2);
    assert.equal(deliveryLog.entries[1].sourceMessageId, 'wamid.group.reply-to-bot');
    assert.equal(deliveryLog.entries[1].state, 'confirmed');
    assert.equal(deliveryLog.entries[1].outboundMessageId, sentMessages[1].messageId);
    assert.equal(deliveryLog.entries[1].targetChatType, 'group');
    assert.equal(deliveryLog.entries[1].ack, 2);
  } finally {
    await runtime.stop();
  }
});
