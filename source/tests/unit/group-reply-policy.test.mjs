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
    async explainAutoReplyInGroup() {
      return {
        allowed: false,
        actorRole: 'member',
        chatType: 'group',
        groupJid: '120363400000000001@g.us',
        interactionPolicy: 'owner_only',
        reasonCode: 'group_member_blocked_by_owner_policy',
        summary: 'Este grupo reserva o bot ao owner; membros nao podem dirigi-lo por tag.',
      };
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
        assistantAccess: {
          allowed: true,
          actorRole: 'member',
          chatType: 'group',
          groupJid: '120363400000000001@g.us',
          interactionPolicy: 'members_can_tag',
          reasonCode: 'group_member_allowed',
          summary: 'Qualquer membro pode dirigir o bot aqui por tag ou reply.',
        },
      },
    },
  );

  assert.deepEqual(decision, {
    shouldReply: false,
    targetChatType: null,
    targetChatJid: null,
    reason: 'group_member_blocked_by_owner_policy',
  });
});
