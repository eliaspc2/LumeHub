import test from 'node:test';
import assert from 'node:assert/strict';

const { GroupAuthorizationPolicy } = await import(
  '../../packages/modules/command-policy/dist/modules/command-policy/src/domain/services/GroupAuthorizationPolicy.js'
);
const { DEFAULT_COMMAND_POLICY_SETTINGS } = await import(
  '../../packages/modules/command-policy/dist/modules/command-policy/src/domain/entities/CommandPolicy.js'
);

test('group auto-reply accepts explicit tag and replies to the bot like WA-notify', () => {
  const policy = new GroupAuthorizationPolicy();
  const settings = {
    ...DEFAULT_COMMAND_POLICY_SETTINGS,
    authorizedGroupJids: ['120363400000000001@g.us'],
  };

  assert.equal(
    policy.canAutoReply(
      {
        groupJid: '120363400000000001@g.us',
        wasTagged: true,
        isReplyToBot: false,
      },
      settings,
    ),
    true,
  );

  assert.equal(
    policy.canAutoReply(
      {
        groupJid: '120363400000000001@g.us',
        wasTagged: false,
        isReplyToBot: true,
      },
      settings,
    ),
    true,
  );

  assert.equal(
    policy.canAutoReply(
      {
        groupJid: '120363400000000001@g.us',
        wasTagged: false,
        isReplyToBot: false,
      },
      settings,
    ),
    false,
  );
});
