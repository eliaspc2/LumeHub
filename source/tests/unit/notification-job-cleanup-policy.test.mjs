import test from 'node:test';
import assert from 'node:assert/strict';

const { PastEventCleanupPolicy } = await import(
  '../../packages/modules/notification-jobs/dist/modules/notification-jobs/src/public/index.js'
);

function createEvent(overrides = {}) {
  return {
    eventId: 'event-1',
    weekId: '2026-W13',
    groupJid: '120363400000000001@g.us',
    groupLabel: 'Turma A',
    title: 'Aula',
    kind: 'lesson',
    eventAt: '2026-03-26T10:00:00.000Z',
    notificationRules: [],
    notifications: [
      {
        jobId: 'job-1',
        ruleId: 'rule-1',
        weekId: '2026-W13',
        ruleType: 'relative_before_event',
        sendAt: '2026-03-25T10:00:00.000Z',
        status: 'sent',
        attempts: 1,
        lastError: null,
        lastOutboundObservationAt: '2026-03-25T10:00:05.000Z',
        confirmedAt: '2026-03-25T10:00:10.000Z',
        suppressedAt: null,
        disabledAt: null,
      },
    ],
    metadata: {},
    ...overrides,
  };
}

test('archives past events only when every notification is already concluded', () => {
  const policy = new PastEventCleanupPolicy();
  const now = new Date('2026-03-26T12:00:00.000Z');

  assert.equal(policy.shouldArchiveEvent(createEvent(), now), true);
  assert.equal(
    policy.shouldArchiveEvent(
      createEvent({
        notifications: [
          {
            jobId: 'job-1',
            ruleId: 'rule-1',
            weekId: '2026-W13',
            ruleType: 'relative_before_event',
            sendAt: '2026-03-25T10:00:00.000Z',
            status: 'waiting_confirmation',
            attempts: 1,
            lastError: null,
            lastOutboundObservationAt: '2026-03-25T10:00:05.000Z',
            confirmedAt: null,
            suppressedAt: null,
            disabledAt: null,
          },
        ],
      }),
      now,
    ),
    false,
  );
});

test('does not archive future events', () => {
  const policy = new PastEventCleanupPolicy();

  assert.equal(
    policy.shouldArchiveEvent(
      createEvent({
        eventAt: '2026-03-27T10:00:00.000Z',
      }),
      new Date('2026-03-26T12:00:00.000Z'),
    ),
    false,
  );
});
