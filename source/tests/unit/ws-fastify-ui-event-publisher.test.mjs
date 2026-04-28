import test from 'node:test';
import assert from 'node:assert/strict';

const { UiEventPublisher, WebSocketSessionRegistry } = await import(
  '../../packages/adapters/ws-fastify/dist/index.js'
);

test('ui event publisher removes broken listeners without breaking the pipeline', () => {
  const registry = new WebSocketSessionRegistry();
  const publisher = new UiEventPublisher(registry);
  const deliveredEvents = [];

  registry.register(() => {
    throw new Error('socket send failed');
  });
  registry.register((event) => {
    deliveredEvents.push(event);
  });

  assert.doesNotThrow(() => {
    publisher.publish('conversation.inbound.received', {
      messageId: 'wamid.001',
    });
  });
  assert.equal(deliveredEvents.length, 1);
  assert.equal(registry.listSessionIds().length, 1);

  assert.doesNotThrow(() => {
    publisher.publish('conversation.reply.generated', {
      messageId: 'wamid.002',
    });
  });
  assert.equal(deliveredEvents.length, 2);
  assert.equal(registry.listSessionIds().length, 1);
});
