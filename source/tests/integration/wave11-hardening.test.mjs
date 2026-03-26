import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const {
  GroupCalendarArchiveRepository,
  GroupCalendarFileRepository,
  GroupPathResolver,
} = await import('../../packages/adapters/persistence-group-files/dist/index.js');
const { NotificationJobsModule } = await import(
  '../../packages/modules/notification-jobs/dist/modules/notification-jobs/src/public/index.js'
);
const { InstructionQueueModule } = await import(
  '../../packages/modules/instruction-queue/dist/modules/instruction-queue/src/public/index.js'
);

test('cleanup archives past concluded events and removes them from the active calendar', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave11-cleanup-'));
  const dataRootPath = join(sandboxPath, 'data');
  const groupJid = '120363400000000001@g.us';
  const pathResolver = new GroupPathResolver({ dataRootPath });
  const calendarRepository = new GroupCalendarFileRepository(pathResolver);
  const archiveRepository = new GroupCalendarArchiveRepository(pathResolver);

  try {
    await calendarRepository.saveCalendarMonth({
      schemaVersion: 1,
      groupJid,
      groupLabel: 'Turma A',
      year: 2026,
      month: 3,
      timezone: 'Europe/Lisbon',
      events: [
        {
          eventId: 'event-past-sent',
          weekId: '2026-W13',
          groupJid,
          groupLabel: 'Turma A',
          title: 'Evento passado',
          kind: 'lesson',
          eventAt: '2026-03-20T09:00:00.000Z',
          notificationRules: [],
          notifications: [
            {
              jobId: 'job-sent',
              ruleId: 'rule-1',
              weekId: '2026-W13',
              ruleType: 'relative_before_event',
              sendAt: '2026-03-19T09:00:00.000Z',
              status: 'sent',
              attempts: 1,
              lastError: null,
              lastOutboundObservationAt: '2026-03-19T09:00:05.000Z',
              confirmedAt: '2026-03-19T09:00:10.000Z',
              suppressedAt: null,
              disabledAt: null,
            },
          ],
        },
        {
          eventId: 'event-past-open',
          weekId: '2026-W13',
          groupJid,
          groupLabel: 'Turma A',
          title: 'Evento em espera',
          kind: 'lesson',
          eventAt: '2026-03-20T12:00:00.000Z',
          notificationRules: [],
          notifications: [
            {
              jobId: 'job-open',
              ruleId: 'rule-2',
              weekId: '2026-W13',
              ruleType: 'relative_before_event',
              sendAt: '2026-03-19T12:00:00.000Z',
              status: 'waiting_confirmation',
              attempts: 1,
              lastError: null,
              lastOutboundObservationAt: '2026-03-19T12:00:05.000Z',
              confirmedAt: null,
              suppressedAt: null,
              disabledAt: null,
            },
          ],
        },
      ],
      deliveryAttempts: [
        {
          attemptId: 'attempt-sent',
          jobId: 'job-sent',
          eventId: 'event-past-sent',
          weekId: '2026-W13',
          groupJid,
          groupLabel: 'Turma A',
          messageId: 'wamid.sent',
          startedAt: '2026-03-19T09:00:00.000Z',
          status: 'confirmed',
          lastError: null,
          observation: null,
          confirmation: null,
        },
        {
          attemptId: 'attempt-open',
          jobId: 'job-open',
          eventId: 'event-past-open',
          weekId: '2026-W13',
          groupJid,
          groupLabel: 'Turma A',
          messageId: 'wamid.open',
          startedAt: '2026-03-19T12:00:00.000Z',
          status: 'observed',
          lastError: null,
          observation: null,
          confirmation: null,
        },
      ],
    });

    const module = new NotificationJobsModule({
      dataRootPath,
    });
    const result = await module.cleanupPastEvents({
      now: new Date('2026-03-26T12:00:00.000Z'),
    });

    assert.equal(result.archivedEventCount, 1);
    assert.equal(result.archivedDeliveryAttemptCount, 1);
    assert.equal(result.touchedCalendarMonths, 1);

    const activeMonth = await calendarRepository.readCalendarMonth({
      groupJid,
      year: 2026,
      month: 3,
    });
    assert.ok(activeMonth);
    assert.deepEqual(
      activeMonth.events.map((event) => event.eventId),
      ['event-past-open'],
    );
    assert.deepEqual(
      activeMonth.deliveryAttempts.map((attempt) => attempt.attemptId),
      ['attempt-open'],
    );

    const archiveMonth = await archiveRepository.readArchiveMonth({
      groupJid,
      year: 2026,
      month: 3,
    });
    assert.ok(archiveMonth);
    assert.equal(archiveMonth.archivedEvents.length, 1);
    assert.equal(archiveMonth.archivedEvents[0].event.eventId, 'event-past-sent');
    assert.equal(archiveMonth.archivedEvents[0].deliveryAttempts.length, 1);
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

test('restart keeps fan-out dedupe and retry only reprocesses failed targets', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave11-queue-'));
  const queueFilePath = join(sandboxPath, 'runtime', 'instruction-queue.json');
  const attempts = new Map();

  try {
    await mkdir(dirname(queueFilePath), { recursive: true });
    await writeFile(queueFilePath, JSON.stringify({ schemaVersion: 1, instructions: [] }, null, 2), 'utf8');

    const createModule = () =>
      new InstructionQueueModule({
        queueFilePath,
        actionExecutor: {
          async execute(action) {
            const current = attempts.get(action.targetGroupJid) ?? 0;
            const next = current + 1;
            attempts.set(action.targetGroupJid, next);

            if (action.targetGroupJid === '120363400000000002@g.us' && next === 1) {
              throw new Error('Simulated partial failure');
            }

            return {
              externalMessageId: `wamid:${action.dedupeKey}:${next}`,
              note: `sent:${action.targetGroupJid}:${next}`,
            };
          },
        },
      });

    const firstRuntime = createModule();
    const instruction = await firstRuntime.enqueueInstruction({
      sourceType: 'fanout_request',
      sourceMessageId: 'wamid.source.001',
      mode: 'confirmed',
      actions: [
        {
          type: 'send_message',
          dedupeKey: 'wamid.source.001:120363400000000001@g.us',
          targetGroupJid: '120363400000000001@g.us',
          payload: { text: 'Turma A' },
        },
        {
          type: 'send_message',
          dedupeKey: 'wamid.source.001:120363400000000002@g.us',
          targetGroupJid: '120363400000000002@g.us',
          payload: { text: 'Turma B' },
        },
      ],
    });

    await firstRuntime.tickWorker();

    const restartedRuntime = createModule();
    const duplicateInstruction = await restartedRuntime.enqueueInstruction({
      sourceType: 'fanout_request',
      sourceMessageId: 'wamid.source.001',
      mode: 'confirmed',
      actions: [
        {
          type: 'send_message',
          dedupeKey: 'wamid.source.001:120363400000000001@g.us',
          targetGroupJid: '120363400000000001@g.us',
          payload: { text: 'Turma A' },
        },
        {
          type: 'send_message',
          dedupeKey: 'wamid.source.001:120363400000000002@g.us',
          targetGroupJid: '120363400000000002@g.us',
          payload: { text: 'Turma B' },
        },
      ],
    });

    assert.equal(duplicateInstruction.actions.every((action) => action.status === 'skipped'), true);

    await restartedRuntime.retryInstruction(instruction.instructionId);
    await restartedRuntime.tickWorker();

    const persisted = JSON.parse(await readFile(queueFilePath, 'utf8'));
    const recoveredInstruction = persisted.instructions.find((candidate) => candidate.instructionId === instruction.instructionId);
    assert.ok(recoveredInstruction);
    assert.equal(recoveredInstruction.status, 'completed');

    const targetA = recoveredInstruction.actions.find((action) => action.targetGroupJid === '120363400000000001@g.us');
    const targetB = recoveredInstruction.actions.find((action) => action.targetGroupJid === '120363400000000002@g.us');
    assert.ok(targetA);
    assert.ok(targetB);
    assert.equal(targetA.attemptCount, 1);
    assert.equal(targetB.attemptCount, 2);
    assert.match(targetA.result.externalMessageId, /:1$/);
    assert.match(targetB.result.externalMessageId, /:2$/);
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});
