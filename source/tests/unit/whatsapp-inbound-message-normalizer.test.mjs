import test from 'node:test';
import assert from 'node:assert/strict';

const { InboundMessageNormalizer } = await import(
  '../../packages/adapters/whatsapp-baileys/dist/index.js'
);

test('whatsapp inbound normalizer unwraps ephemeral tagged messages', () => {
  const normalizer = new InboundMessageNormalizer();
  const normalized = normalizer.normalize({
    key: {
      id: 'wamid.ephemeral.001',
      remoteJid: '120363400000000001@g.us',
      participant: '351910000001@s.whatsapp.net',
      fromMe: false,
    },
    messageTimestamp: 1_777_000_000,
    pushName: 'Ana',
    message: {
      ephemeralMessage: {
        message: {
          extendedTextMessage: {
            text: '@Lume consegues responder aqui?',
            contextInfo: {
              mentionedJid: ['351910000099@s.whatsapp.net'],
              participant: '351910000099@s.whatsapp.net',
              stanzaId: 'wamid.previous.001',
            },
          },
        },
      },
    },
  });

  assert.ok(normalized);
  assert.equal(normalized?.text, '@Lume consegues responder aqui?');
  assert.deepEqual(normalized?.mentionedJids, ['351910000099@s.whatsapp.net']);
  assert.equal(normalized?.quotedParticipantJid, '351910000099@s.whatsapp.net');
  assert.equal(normalized?.quotedMessageId, 'wamid.previous.001');
});

test('whatsapp inbound normalizer unwraps group mentioned messages', () => {
  const normalizer = new InboundMessageNormalizer();
  const normalized = normalizer.normalize({
    key: {
      id: 'wamid.groupmentioned.001',
      remoteJid: '120363400000000001@g.us',
      participant: '351910000002@s.whatsapp.net',
      fromMe: false,
    },
    messageTimestamp: 1_777_000_001,
    pushName: 'Bruno',
    message: {
      groupMentionedMessage: {
        message: {
          extendedTextMessage: {
            text: '@Lume preciso da tua ajuda',
            contextInfo: {
              mentionedJid: ['351928308015:15@s.whatsapp.net'],
            },
          },
        },
      },
    },
  });

  assert.ok(normalized);
  assert.equal(normalized?.text, '@Lume preciso da tua ajuda');
  assert.deepEqual(normalized?.mentionedJids, ['351928308015:15@s.whatsapp.net']);
});

test('whatsapp inbound normalizer reads generic mention wrappers and context', () => {
  const normalizer = new InboundMessageNormalizer();
  const normalized = normalizer.normalize({
    key: {
      id: 'wamid.generic.mention.001',
      remoteJid: '120363400000000001@g.us',
      participant: '135875669303359@lid',
      fromMe: false,
    },
    messageTimestamp: 1_777_000_002,
    pushName: 'Carla',
    message: {
      messageContextInfo: {
        mentionedJid: ['232276864532729:15@lid'],
      },
      extendedTextMessage: {
        text: 'Assim falha',
        contextInfo: {
          mentionedJid: ['232276864532729:15@lid'],
          participant: '232276864532729:15@lid',
          stanzaId: 'wamid.previous.lid.001',
        },
      },
    },
  });

  assert.ok(normalized);
  assert.equal(normalized?.text, 'Assim falha');
  assert.deepEqual(normalized?.mentionedJids, ['232276864532729:15@lid']);
  assert.equal(normalized?.quotedParticipantJid, '232276864532729:15@lid');
  assert.equal(normalized?.quotedMessageId, 'wamid.previous.lid.001');
});
