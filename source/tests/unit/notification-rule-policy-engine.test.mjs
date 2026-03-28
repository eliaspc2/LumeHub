import test from 'node:test';
import assert from 'node:assert/strict';

const { NotificationRulePolicyEngine } = await import(
  '../../packages/modules/notification-rules/dist/modules/notification-rules/src/public/index.js'
);

test('relative_before_event combines daysBeforeEvent and offsetMinutesBeforeEvent into a single offset', () => {
  const engine = new NotificationRulePolicyEngine();
  const event = {
    eventId: 'event-wave23-offset',
    weekId: '2026-W13',
    groupJid: '120363402446203704@g.us',
    groupLabel: 'EFA Programacao A',
    title: 'Sessao de apoio',
    kind: 'lesson',
    eventAt: '2026-03-27T18:30:00.000Z',
  };

  const [rule] = engine.derive(event, [
    {
      kind: 'relative_before_event',
      daysBeforeEvent: 1,
      offsetMinutesBeforeEvent: 30,
    },
  ]);

  assert.equal(rule.offsetMinutesBeforeEvent, 1_470);
  assert.equal(rule.daysBeforeEvent, null);
  assert.equal(rule.label, '1470m before');
  assert.equal(rule.ruleId, 'rule-event-wave23-offset-before-1470');
});

test('deriveDefaults keeps the canonical 24h and 30m defaults', () => {
  const engine = new NotificationRulePolicyEngine();
  const event = {
    eventId: 'event-wave23-defaults',
    weekId: '2026-W13',
    groupJid: '120363402446203704@g.us',
    groupLabel: 'EFA Programacao A',
    title: 'Sessao de apoio',
    kind: 'lesson',
    eventAt: '2026-03-27T18:30:00.000Z',
  };

  const rules = engine.deriveDefaults(event);

  assert.deepEqual(
    rules.map((rule) => ({
      label: rule.label,
      offsetMinutesBeforeEvent: rule.offsetMinutesBeforeEvent,
    })),
    [
      {
        label: '24h before',
        offsetMinutesBeforeEvent: 1_440,
      },
      {
        label: '30m before',
        offsetMinutesBeforeEvent: 30,
      },
    ],
  );
});
