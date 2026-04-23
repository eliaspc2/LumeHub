import test from 'node:test';
import assert from 'node:assert/strict';

const {
  DeliveryResolutionPolicy,
  DeliveryTrackerService,
} = await import('../../packages/modules/delivery-tracker/dist/modules/delivery-tracker/src/public/index.js');

function createJob(overrides = {}) {
  return {
    jobId: 'job-1',
    eventId: 'event-1',
    ruleId: 'rule-1',
    weekId: '2026-W17',
    groupJid: '120363400000000001@g.us',
    groupLabel: 'Turma A',
    title: 'Aula',
    kind: 'lesson',
    eventAt: '2026-04-23T11:00:00.000Z',
    timeZone: 'Europe/Lisbon',
    ruleType: 'relative_before_event',
    ruleLabel: '30 min antes',
    messageTemplate: 'Lembrete',
    llmPromptTemplate: null,
    sendAt: '2026-04-23T10:30:00.000Z',
    status: 'pending',
    preparedAt: null,
    preparedInstructionId: null,
    preparedActionId: null,
    attempts: 0,
    lastError: null,
    lastOutboundObservationAt: null,
    confirmedAt: null,
    suppressedAt: null,
    disabledAt: null,
    ...overrides,
  };
}

function createAttempt(overrides = {}) {
  return {
    attemptId: 'attempt-1',
    jobId: 'job-1',
    eventId: 'event-1',
    weekId: '2026-W17',
    groupJid: '120363400000000001@g.us',
    groupLabel: 'Turma A',
    messageId: '3EB01234567890',
    startedAt: '2026-04-23T10:30:05.000Z',
    status: 'started',
    lastError: null,
    observation: null,
    confirmation: null,
    ...overrides,
  };
}

test('registerAttemptStarted marks the accepted reminder as operationally observed', async () => {
  const jobs = [createJob()];
  const attempts = [];
  const attemptRepository = {
    async listAttempts(query = {}) {
      return attempts
        .filter((attempt) => !query.jobId || attempt.jobId === query.jobId)
        .filter((attempt) => !query.messageId || attempt.messageId === query.messageId)
        .filter((attempt) => !query.groupJid || attempt.groupJid === query.groupJid);
    },
    async readAttemptById(attemptId) {
      return attempts.find((attempt) => attempt.attemptId === attemptId);
    },
    async readAttemptByMessageId(messageId) {
      return attempts.find((attempt) => attempt.messageId === messageId);
    },
    async readLatestAttemptForJob(jobId) {
      return attempts.find((attempt) => attempt.jobId === jobId);
    },
    async saveAttempt(attempt) {
      const index = attempts.findIndex((current) => current.attemptId === attempt.attemptId);

      if (index >= 0) {
        attempts[index] = attempt;
      } else {
        attempts.push(attempt);
      }

      return attempt;
    },
  };
  const notificationJobRepository = {
    async listJobs(query = {}) {
      return jobs.filter((job) => !query.groupJid || job.groupJid === query.groupJid);
    },
    async replaceJobs() {
      throw new Error('replaceJobs should not be called in this test.');
    },
    async updateJob(jobId, mutator) {
      const index = jobs.findIndex((job) => job.jobId === jobId);

      if (index < 0) {
        return undefined;
      }

      jobs[index] = mutator(jobs[index]);
      return jobs[index];
    },
  };
  const service = new DeliveryTrackerService(
    attemptRepository,
    notificationJobRepository,
    undefined,
    undefined,
    { now: () => new Date('2026-04-23T10:30:05.000Z') },
  );

  await service.registerAttemptStarted({
    jobId: 'job-1',
    messageId: '3EB01234567890',
  });

  assert.equal(jobs[0].status, 'waiting_confirmation');
  assert.equal(jobs[0].attempts, 1);
  assert.equal(jobs[0].lastOutboundObservationAt, '2026-04-23T10:30:05.000Z');
});

test('delivery resolution keeps the latest accepted attempt as observation fallback', () => {
  const policy = new DeliveryResolutionPolicy();

  const resolved = policy.resolve(
    createJob({
      status: 'waiting_confirmation',
      attempts: 1,
    }),
    [createAttempt()],
  );

  assert.equal(resolved.status, 'waiting_confirmation');
  assert.equal(resolved.lastOutboundObservationAt, '2026-04-23T10:30:05.000Z');
});
