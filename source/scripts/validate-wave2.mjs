import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { DEFAULT_TIMEZONE } = await import('../packages/adapters/persistence-group-files/dist/index.js');
const { ScheduleWeeksModule } = await import('../packages/modules/schedule-weeks/dist/modules/schedule-weeks/src/public/index.js');
const { ScheduleEventsModule } = await import('../packages/modules/schedule-events/dist/modules/schedule-events/src/public/index.js');
const { NotificationRulesModule } = await import('../packages/modules/notification-rules/dist/modules/notification-rules/src/public/index.js');
const { NotificationJobsModule } = await import('../packages/modules/notification-jobs/dist/modules/notification-jobs/src/public/index.js');

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave2-'));
const dataRootPath = join(sandboxPath, 'data');

try {
  const sharedConfig = {
    dataRootPath,
  };
  const scheduleWeeks = new ScheduleWeeksModule(sharedConfig);
  const scheduleEvents = new ScheduleEventsModule(sharedConfig);
  const notificationRules = new NotificationRulesModule(sharedConfig);
  const notificationJobs = new NotificationJobsModule(sharedConfig);

  const createdEvent = await scheduleEvents.createEvent({
    groupJid: '120363407086801381@g.us',
    groupLabel: 'Wave 2 Validation',
    title: 'Reuniao semanal',
    kind: 'class_sync',
    eventAt: '2026-03-25T10:00:00+00:00',
    timeZone: DEFAULT_TIMEZONE,
    target: {
      type: 'discipline',
      id: 'math-1',
      label: 'Matematica I',
    },
  });

  assert.equal(createdEvent.title, 'Reuniao semanal');
  assert.equal(createdEvent.notificationRules.length, 0);
  assert.equal(createdEvent.notifications.length, 0);

  const listedEvents = await scheduleEvents.listEventsByWeek(createdEvent.weekId, {
    groupJid: createdEvent.groupJid,
  });
  assert.equal(listedEvents.length, 1);
  assert.equal(listedEvents[0]?.eventId, createdEvent.eventId);

  const ensuredWeek = await scheduleWeeks.ensureWeekForDate(createdEvent.eventAt, {
    groupJid: createdEvent.groupJid,
    timeZone: DEFAULT_TIMEZONE,
  });
  assert.equal(ensuredWeek.weekId, createdEvent.weekId);

  const defaultRules = await notificationRules.deriveRulesForEvent(createdEvent.eventId, undefined, {
    groupJid: createdEvent.groupJid,
  });
  assert.deepEqual(
    defaultRules.map((rule) => rule.offsetMinutesBeforeEvent),
    [1_440, 30],
  );

  const zeroRules = await notificationRules.replaceRulesForEvent(
    createdEvent.eventId,
    [],
    {
      groupJid: createdEvent.groupJid,
    },
  );
  assert.equal(zeroRules.length, 0);

  const zeroJobs = await notificationJobs.materializeForEvent(createdEvent.eventId, {
    groupJid: createdEvent.groupJid,
  });
  assert.equal(zeroJobs.length, 0);

  const customRules = await notificationRules.replaceRulesForEvent(
    createdEvent.eventId,
    [
      {
        kind: 'relative_before_event',
        offsetMinutesBeforeEvent: 1_440,
      },
      {
        kind: 'relative_before_event',
        offsetMinutesBeforeEvent: 30,
      },
      {
        kind: 'fixed_local_time',
        daysBeforeEvent: 1,
        localTime: '20:00',
      },
    ],
    {
      groupJid: createdEvent.groupJid,
    },
  );
  assert.equal(customRules.length, 3);
  assert.equal(customRules.some((rule) => rule.kind === 'fixed_local_time'), true);

  const materializedJobs = await notificationJobs.materializeForEvent(createdEvent.eventId, {
    groupJid: createdEvent.groupJid,
  });
  assert.equal(materializedJobs.length, 3);
  assert.deepEqual(
    [...new Set(materializedJobs.map((job) => job.status))],
    ['pending'],
  );

  const pendingBeforeStatusChanges = await notificationJobs.listPendingJobs({
    groupJid: createdEvent.groupJid,
    weekId: createdEvent.weekId,
  });
  assert.equal(pendingBeforeStatusChanges.length, 3);

  const eventWithStatusMix = await scheduleEvents.updateEvent(
    createdEvent.eventId,
    {
      notifications: materializedJobs.map((job, index) => ({
        jobId: job.jobId,
        ruleId: job.ruleId,
        weekId: job.weekId,
        ruleType: job.ruleType,
        sendAt: job.sendAt,
        status: index === 0 ? 'pending' : index === 1 ? 'waiting_confirmation' : 'sent',
        attempts: job.attempts,
        lastError: job.lastError,
        lastOutboundObservationAt: job.lastOutboundObservationAt,
        confirmedAt: index === 2 ? '2026-03-24T20:10:00.000Z' : null,
        suppressedAt: null,
        disabledAt: null,
      })),
    },
    {
      groupJid: createdEvent.groupJid,
    },
  );

  assert.deepEqual(
    eventWithStatusMix.notifications.map((job) => job.status),
    ['pending', 'waiting_confirmation', 'sent'],
  );

  const pendingAfterStatusChanges = await notificationJobs.listPendingJobs({
    groupJid: createdEvent.groupJid,
    weekId: createdEvent.weekId,
  });
  assert.equal(pendingAfterStatusChanges.length, 1);
  assert.equal(pendingAfterStatusChanges[0]?.status, 'pending');

  const suppressed = await notificationJobs.markSuppressed(pendingAfterStatusChanges[0].jobId, {
    groupJid: createdEvent.groupJid,
  });
  assert.ok(suppressed?.suppressedAt);

  const pendingAfterSuppression = await notificationJobs.listPendingJobs({
    groupJid: createdEvent.groupJid,
    weekId: createdEvent.weekId,
  });
  assert.equal(pendingAfterSuppression.length, 0);

  console.log(`Wave 2 validation passed in ${sandboxPath}`);
} finally {
  await rm(sandboxPath, { recursive: true, force: true });
}
