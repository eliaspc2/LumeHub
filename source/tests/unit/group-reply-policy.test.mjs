import test from 'node:test';
import assert from 'node:assert/strict';

const { GroupReplyPolicy } = await import(
  '../../packages/modules/conversation/dist/modules/conversation/src/public/index.js'
);

test('group replies are suppressed instead of being rerouted to private chats', async () => {
  const policy = new GroupReplyPolicy({
    async canAutoReplyInGroup() {
      return false;
    },
  });

  const decision = await policy.decide(
    {
      chatType: 'group',
      chatJid: '120363400000000001@g.us',
      groupJid: '120363400000000001@g.us',
      privateReplyJid: '351910000001@s.whatsapp.net',
    },
    {
      plan: {
        allowReply: true,
      },
      replyText: 'Resposta que nao devia sair por privado.',
      session: {
        classification: {
          intent: 'casual_chat',
        },
      },
    },
  );

  assert.deepEqual(decision, {
    shouldReply: false,
    targetChatType: null,
    targetChatJid: null,
    reason: 'group_reply_not_permitted',
  });
});
