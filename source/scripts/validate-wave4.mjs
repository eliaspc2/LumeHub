import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { DEFAULT_TIMEZONE } = await import('../packages/adapters/persistence-group-files/dist/index.js');
const { FakeClock } = await import('../packages/foundation/clock/dist/index.js');
const { ScheduleEventsModule } = await import('../packages/modules/schedule-events/dist/modules/schedule-events/src/public/index.js');
const { NotificationRulesModule } = await import('../packages/modules/notification-rules/dist/modules/notification-rules/src/public/index.js');
const { NotificationJobsModule } = await import('../packages/modules/notification-jobs/dist/modules/notification-jobs/src/public/index.js');
const { DeliveryTrackerModule } = await import('../packages/modules/delivery-tracker/dist/modules/delivery-tracker/src/public/index.js');
const { ScheduleDispatcherModule } = await import('../packages/modules/schedule-dispatcher/dist/modules/schedule-dispatcher/src/public/index.js');
const { WatchdogModule } = await import('../packages/modules/watchdog/dist/modules/watchdog/src/public/index.js');
const { HealthMonitorModule } = await import('../packages/modules/health-monitor/dist/modules/health-monitor/src/public/index.js');

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave4-'));
const dataRootPath = join(sandboxPath, 'data');

try {
  const clock = new FakeClock(new Date('2026-03-26T11:40:00.000Z'));
  const sendCalls = [];
  const gateway = {
    async sendText(input) {
      sendCalls.push({
        ...input,
        sentAt: clock.now().toISOString(),
      });
      await new Promise((resolve) => setTimeout(resolve, 75));

      return {
        messageId: `wamid.test.${sendCalls.length}`,
        chatJid: input.chatJid,
        acceptedAt: clock.now().toISOString(),
        idempotencyKey: input.idempotencyKey,
      };
    },
    async ingestInboundEnvelope() {
      return undefined;
    },
    async ingestOutboundObservation() {
      return undefined;
    },
    async ingestOutboundConfirmation() {
      return undefined;
    },
    subscribeInbound() {
      return () => undefined;
    },
  };

  const sharedConfig = {
    dataRootPath,
    clock,
  };
  const scheduleEvents = new ScheduleEventsModule(sharedConfig);
  const notificationRules = new NotificationRulesModule(sharedConfig);
  const notificationJobs = new NotificationJobsModule(sharedConfig);
  const deliveryTracker = new DeliveryTrackerModule(sharedConfig);
  const dispatcher = new ScheduleDispatcherModule({
    ...sharedConfig,
    gateway,
    deliveryTrackerService: deliveryTracker.service,
  });
  const watchdog = new WatchdogModule({
    ...sharedConfig,
    overdueGraceMinutes: 5,
    waitingConfirmationGraceMinutes: 10,
  });
  const healthMonitor = new HealthMonitorModule({
    ...sharedConfig,
    moduleHealthProvider: async () => [
      {
        status: 'healthy',
        details: {
          module: 'dispatcher',
        },
      },
      {
        status: 'healthy',
        details: {
          module: 'watchdog',
        },
      },
    ],
  });

  const dispatchEvent = await scheduleEvents.createEvent({
    groupJid: '120363407086801381@g.us',
    groupLabel: 'Wave 4 Validation',
    title: 'Aula de algebra',
    kind: 'class_reminder',
    eventAt: '2026-03-26T12:00:00+00:00',
    timeZone: DEFAULT_TIMEZONE,
  });
  await notificationRules.replaceRulesForEvent(
    dispatchEvent.eventId,
    [
      {
        kind: 'relative_before_event',
        offsetMinutesBeforeEvent: 30,
      },
    ],
    {
      groupJid: dispatchEvent.groupJid,
    },
  );
  const dispatchJobs = await notificationJobs.materializeForEvent(dispatchEvent.eventId, {
    groupJid: dispatchEvent.groupJid,
  });
  assert.equal(dispatchJobs.length, 1);

  const [firstTick, secondTick] = await Promise.all([
    dispatcher.tick({
      now: clock.now(),
      groupJid: dispatchEvent.groupJid,
    }),
    dispatcher.tick({
      now: clock.now(),
      groupJid: dispatchEvent.groupJid,
    }),
  ]);

  assert.equal(sendCalls.length, 1);
  assert.equal(firstTick.results.some((result) => result.status === 'started'), true);
  assert.equal(secondTick.results.some((result) => result.status === 'started'), false);

  const overdueEvent = await scheduleEvents.createEvent({
    groupJid: '120363407086801381@g.us',
    groupLabel: 'Wave 4 Validation',
    title: 'Aviso em atraso',
    kind: 'late_reminder',
    eventAt: '2026-03-26T11:00:00+00:00',
    timeZone: DEFAULT_TIMEZONE,
  });
  await notificationRules.replaceRulesForEvent(
    overdueEvent.eventId,
    [
      {
        kind: 'relative_before_event',
        offsetMinutesBeforeEvent: 30,
      },
    ],
    {
      groupJid: overdueEvent.groupJid,
    },
  );
  const overdueJobs = await notificationJobs.materializeForEvent(overdueEvent.eventId, {
    groupJid: overdueEvent.groupJid,
  });
  assert.equal(overdueJobs.length, 1);

  let currentJobs = await notificationJobs.service.repository.listJobs({
    groupJid: dispatchEvent.groupJid,
  });
  const dispatchedJob = currentJobs.find((job) => job.jobId === dispatchJobs[0].jobId);
  assert.equal(dispatchedJob?.status, 'waiting_confirmation');
  assert.equal(dispatchedJob?.attempts, 1);

  let watchdogTick = await watchdog.tick({
    now: clock.now(),
    groupJid: dispatchEvent.groupJid,
  });
  assert.equal(watchdogTick.raised.length, 1);
  assert.equal(watchdogTick.raised[0]?.kind, 'job_overdue');

  let issues = await watchdog.listIssues({
    groupJid: dispatchEvent.groupJid,
    status: 'open',
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.jobId, overdueJobs[0].jobId);

  clock.set(new Date('2026-03-26T11:51:00.000Z'));
  watchdogTick = await watchdog.tick({
    now: clock.now(),
    groupJid: dispatchEvent.groupJid,
  });
  assert.equal(watchdogTick.raised.some((issue) => issue.kind === 'waiting_confirmation_timeout'), true);

  issues = await watchdog.listIssues({
    groupJid: dispatchEvent.groupJid,
    status: 'open',
  });
  assert.equal(issues.length, 2);

  const confirmation = await deliveryTracker.registerConfirmation(
    {
      jobId: dispatchJobs[0].jobId,
      messageId: 'wamid.test.1',
      chatJid: dispatchEvent.groupJid,
      source: 'messages.update',
      ack: 2,
    },
    {
      groupJid: dispatchEvent.groupJid,
    },
  );
  assert.equal(confirmation?.status, 'confirmed');

  await watchdog.tick({
    now: clock.now(),
    groupJid: dispatchEvent.groupJid,
  });

  currentJobs = await notificationJobs.service.repository.listJobs({
    groupJid: dispatchEvent.groupJid,
  });
  const confirmedJob = currentJobs.find((job) => job.jobId === dispatchJobs[0].jobId);
  assert.equal(confirmedJob?.status, 'sent');

  issues = await watchdog.listIssues({
    groupJid: dispatchEvent.groupJid,
    status: 'open',
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.jobId, overdueJobs[0].jobId);

  const snapshot = await healthMonitor.getHealthSnapshot(dispatchEvent.groupJid);
  assert.equal(snapshot.watchdog.openIssues, 1);
  assert.equal(snapshot.jobs.waitingConfirmation, 0);
  assert.equal(snapshot.jobs.sent >= 1, true);
  assert.equal(snapshot.status, 'degraded');

  console.log(`Wave 4 validation passed in ${sandboxPath}`);
} finally {
  await rm(sandboxPath, { recursive: true, force: true });
}
