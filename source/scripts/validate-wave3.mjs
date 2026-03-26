import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { DEFAULT_TIMEZONE } = await import('../packages/adapters/persistence-group-files/dist/index.js');
const {
  BaileysWhatsAppGateway,
  InboundMessageNormalizer,
} = await import('../packages/adapters/whatsapp-baileys/dist/index.js');
const { ScheduleEventsModule } = await import('../packages/modules/schedule-events/dist/modules/schedule-events/src/public/index.js');
const { NotificationRulesModule } = await import('../packages/modules/notification-rules/dist/modules/notification-rules/src/public/index.js');
const { NotificationJobsModule } = await import('../packages/modules/notification-jobs/dist/modules/notification-jobs/src/public/index.js');
const { DeliveryTrackerModule } = await import('../packages/modules/delivery-tracker/dist/modules/delivery-tracker/src/public/index.js');

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave3-'));
const dataRootPath = join(sandboxPath, 'data');

try {
  const sharedConfig = {
    dataRootPath,
  };
  const normalizer = new InboundMessageNormalizer();
  const gateway = new BaileysWhatsAppGateway();
  const scheduleEvents = new ScheduleEventsModule(sharedConfig);
  const notificationRules = new NotificationRulesModule(sharedConfig);
  const notificationJobs = new NotificationJobsModule(sharedConfig);
  const deliveryTracker = new DeliveryTrackerModule(sharedConfig);

  const normalizedInbound = normalizer.normalize({
    key: {
      id: 'inbound-001',
      remoteJid: '120363407086801381@g.us',
      participant: '351912345678@s.whatsapp.net',
      fromMe: false,
    },
    message: {
      conversation: ' Ola bot ',
    },
    messageTimestamp: 1_772_000_000,
    pushName: 'Elias',
  });

  assert.equal(normalizedInbound?.messageId, 'inbound-001');
  assert.equal(normalizedInbound?.chatJid, '120363407086801381@g.us');
  assert.equal(normalizedInbound?.participantJid, '351912345678@s.whatsapp.net');
  assert.equal(normalizedInbound?.text, 'Ola bot');
  assert.ok(normalizedInbound?.semanticFingerprint.includes('ola bot'));

  const createdEvent = await scheduleEvents.createEvent({
    groupJid: '120363407086801381@g.us',
    groupLabel: 'Wave 3 Validation',
    title: 'Aviso de aula',
    kind: 'class_reminder',
    eventAt: '2026-03-26T12:00:00+00:00',
    timeZone: DEFAULT_TIMEZONE,
  });

  await notificationRules.replaceRulesForEvent(
    createdEvent.eventId,
    [
      {
        kind: 'relative_before_event',
        offsetMinutesBeforeEvent: 30,
      },
    ],
    {
      groupJid: createdEvent.groupJid,
    },
  );

  const materializedJobs = await notificationJobs.materializeForEvent(createdEvent.eventId, {
    groupJid: createdEvent.groupJid,
  });
  assert.equal(materializedJobs.length, 1);
  assert.equal(materializedJobs[0]?.status, 'pending');

  const sendResult = await gateway.sendText({
    chatJid: createdEvent.groupJid,
    text: 'A aula comeca em 30 minutos.',
    idempotencyKey: materializedJobs[0].jobId,
  });

  const pendingAfterSend = await notificationJobs.listPendingJobs({
    groupJid: createdEvent.groupJid,
    weekId: createdEvent.weekId,
  });
  assert.equal(pendingAfterSend.length, 1);
  assert.equal(pendingAfterSend[0]?.status, 'pending');
  assert.equal(sendResult.messageId.startsWith('wamid.'), true);

  const startedAttempt = await deliveryTracker.registerAttemptStarted(
    {
      jobId: materializedJobs[0].jobId,
      messageId: sendResult.messageId,
    },
    {
      groupJid: createdEvent.groupJid,
    },
  );
  assert.equal(startedAttempt.status, 'started');

  let resolution = await deliveryTracker.resolvePendingAttempt(materializedJobs[0].jobId, {
    groupJid: createdEvent.groupJid,
  });
  assert.equal(resolution?.job.status, 'waiting_confirmation');
  assert.equal(resolution?.job.confirmedAt, null);

  const observation = await gateway.ingestOutboundObservation({
    jobId: materializedJobs[0].jobId,
    messageId: sendResult.messageId,
    chatJid: createdEvent.groupJid,
    source: 'append',
  });
  assert.ok(observation);

  const observedAttempt = await deliveryTracker.registerObservation(observation, {
    groupJid: createdEvent.groupJid,
  });
  assert.equal(observedAttempt?.status, 'observed');

  const restartedTracker = new DeliveryTrackerModule(sharedConfig);
  resolution = await restartedTracker.resolvePendingAttempt(materializedJobs[0].jobId, {
    groupJid: createdEvent.groupJid,
  });
  assert.equal(resolution?.job.status, 'waiting_confirmation');
  assert.equal(resolution?.job.confirmedAt, null);
  assert.equal(resolution?.job.lastOutboundObservationAt, observation.observedAt);

  const weakConfirmation = await gateway.ingestOutboundConfirmation({
    jobId: materializedJobs[0].jobId,
    messageId: sendResult.messageId,
    chatJid: createdEvent.groupJid,
    source: 'status',
    ack: 1,
  });
  assert.equal(weakConfirmation, undefined);

  const strongConfirmation = await gateway.ingestOutboundConfirmation({
    jobId: materializedJobs[0].jobId,
    messageId: sendResult.messageId,
    chatJid: createdEvent.groupJid,
    source: 'messages.update',
    ack: 2,
  });
  assert.ok(strongConfirmation);

  const confirmedAttempt = await deliveryTracker.registerConfirmation(strongConfirmation, {
    groupJid: createdEvent.groupJid,
  });
  assert.equal(confirmedAttempt?.status, 'confirmed');

  resolution = await deliveryTracker.resolvePendingAttempt(materializedJobs[0].jobId, {
    groupJid: createdEvent.groupJid,
  });
  assert.equal(resolution?.job.status, 'sent');
  assert.equal(resolution?.job.confirmedAt, strongConfirmation.confirmedAt);

  console.log(`Wave 3 validation passed in ${sandboxPath}`);
} finally {
  await rm(sandboxPath, { recursive: true, force: true });
}
