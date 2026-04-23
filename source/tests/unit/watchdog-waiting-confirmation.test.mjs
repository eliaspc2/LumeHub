import test from 'node:test';
import assert from 'node:assert/strict';

const {
  IssueCollector,
  WatchdogService,
} = await import('../../packages/modules/watchdog/dist/modules/watchdog/src/public/index.js');

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
    status: 'waiting_confirmation',
    preparedAt: '2026-04-23T10:29:55.000Z',
    preparedInstructionId: 'instruction-1',
    preparedActionId: 'action-1',
    attempts: 1,
    lastError: null,
    lastOutboundObservationAt: '2026-04-23T10:30:05.000Z',
    confirmedAt: null,
    suppressedAt: null,
    disabledAt: null,
    ...overrides,
  };
}

test('issue collector ignores waiting_confirmation jobs already observed operationally', () => {
  const collector = new IssueCollector();

  const issues = collector.collect(
    [createJob()],
    new Date('2026-04-23T11:30:00.000Z'),
    {
      overdueGraceMinutes: 5,
      waitingConfirmationGraceMinutes: 15,
    },
  );

  assert.deepEqual(issues, []);
});

test('watchdog resolves stale waiting_confirmation issues once the job has observation', async () => {
  const issues = [
    {
      issueId: 'issue-1',
      kind: 'waiting_confirmation_timeout',
      jobId: 'job-1',
      weekId: '2026-W17',
      groupJid: '120363400000000001@g.us',
      groupLabel: 'Turma A',
      openedAt: '2026-04-23T10:50:00.000Z',
      resolvedAt: null,
      status: 'open',
      summary: 'Job job-1 ficou demasiado tempo em waiting_confirmation.',
    },
  ];
  const resolvedIssueIds = [];
  const service = new WatchdogService(
    {
      async listJobs(query = {}) {
        return [createJob()].filter((job) => !query.groupJid || job.groupJid === query.groupJid);
      },
      async replaceJobs() {
        throw new Error('replaceJobs should not be called in this test.');
      },
      async updateJob() {
        throw new Error('updateJob should not be called in this test.');
      },
    },
    {
      async listIssues(query = {}) {
        return issues.filter((issue) => !query.status || issue.status === query.status);
      },
      async saveIssue(issue) {
        const index = issues.findIndex((current) => current.issueId === issue.issueId);

        if (index >= 0) {
          issues[index] = issue;
        } else {
          issues.push(issue);
        }

        return issue;
      },
      async readOpenIssue(kind, jobId, groupJid) {
        return issues.find(
          (issue) =>
            issue.status === 'open'
            && issue.kind === kind
            && issue.jobId === jobId
            && issue.groupJid === groupJid,
        );
      },
    },
    new IssueCollector(),
    {
      async notifyRaised() {},
      async notifyResolved(issue) {
        resolvedIssueIds.push(issue.issueId);
      },
    },
    { now: () => new Date('2026-04-23T11:30:00.000Z') },
  );

  const result = await service.tick();

  assert.equal(result.raised.length, 0);
  assert.equal(result.resolved.length, 1);
  assert.deepEqual(resolvedIssueIds, ['issue-1']);
  assert.equal(issues[0].status, 'resolved');
});
