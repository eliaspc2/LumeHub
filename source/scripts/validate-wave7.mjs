import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { GroupDirectoryModule } = await import(
  '../packages/modules/group-directory/dist/modules/group-directory/src/public/index.js'
);
const { PeopleMemoryModule } = await import(
  '../packages/modules/people-memory/dist/modules/people-memory/src/public/index.js'
);
const { AudienceRoutingModule } = await import(
  '../packages/modules/audience-routing/dist/modules/audience-routing/src/public/index.js'
);
const { CommandPolicyModule } = await import(
  '../packages/modules/command-policy/dist/modules/command-policy/src/public/index.js'
);
const { InstructionQueueModule } = await import(
  '../packages/modules/instruction-queue/dist/modules/instruction-queue/src/public/index.js'
);
const { OwnerControlModule } = await import(
  '../packages/modules/owner-control/dist/modules/owner-control/src/public/index.js'
);
const { IntentClassifierModule } = await import(
  '../packages/modules/intent-classifier/dist/modules/intent-classifier/src/public/index.js'
);

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave7-'));

try {
  const dataRootPath = join(sandboxPath, 'data');
  const configRootPath = join(sandboxPath, 'config');
  const groupSeedFilePath = join(configRootPath, 'groups.json');
  const catalogFilePath = join(configRootPath, 'discipline_catalog.json');
  const peopleFilePath = join(configRootPath, 'people.json');
  const rulesFilePath = join(configRootPath, 'audience_rules.json');
  const groupProgrammingA = '120363402446203704@g.us';
  const groupProgrammingB = '120363402446203705@g.us';
  const groupCyber = '120363407086801381@g.us';
  const newGroupJid = '120363499999999999@g.us';
  const teacherIdentifiers = [
    {
      kind: 'whatsapp_jid',
      value: '351910000001@s.whatsapp.net',
    },
  ];
  const executionAttempts = new Map();

  await mkdir(configRootPath, { recursive: true });

  await writeFile(
    groupSeedFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        groups: [
          {
            groupJid: groupProgrammingA,
            preferredSubject: 'EFA Programador/a de Informatica - Turma A',
            aliases: ['Programacao A'],
            courseId: 'course-programming',
            groupOwners: [
              {
                personId: 'person-ana',
                assignedAt: '2026-03-26T19:10:00.000Z',
                assignedBy: 'person-app-owner',
              },
            ],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            lastRefreshedAt: '2026-03-26T19:10:00.000Z',
          },
          {
            groupJid: groupProgrammingB,
            preferredSubject: 'EFA Programador/a de Informatica - Turma B',
            aliases: ['Programacao B'],
            courseId: 'course-programming',
            groupOwners: [],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            lastRefreshedAt: '2026-03-26T19:10:00.000Z',
          },
          {
            groupJid: groupCyber,
            preferredSubject: 'CET Ciberseguranca',
            aliases: ['Cyber'],
            courseId: 'course-cyber',
            groupOwners: [],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read',
              appOwner: 'read_write',
            },
            lastRefreshedAt: '2026-03-26T19:10:00.000Z',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    catalogFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        courses: [
          {
            courseId: 'course-programming',
            title: 'UFCD - Programacao',
            groupJid: groupProgrammingA,
            preferredSubject: 'EFA Programador/a de Informatica - Turma A',
            aliases: ['Programacao A'],
          },
          {
            courseId: 'course-programming',
            title: 'UFCD - Programacao',
            groupJid: groupProgrammingB,
            preferredSubject: 'EFA Programador/a de Informatica - Turma B',
            aliases: ['Programacao B'],
          },
          {
            courseId: 'course-cyber',
            title: 'UC - Ciberseguranca',
            groupJid: groupCyber,
            preferredSubject: 'CET Ciberseguranca',
            aliases: ['Cyber'],
          },
        ],
        disciplines: [
          {
            code: 'UFCD-0777',
            title: 'Programacao Base',
            courseId: 'course-programming',
            aliases: ['0777'],
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    peopleFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        people: [
          {
            personId: 'person-app-owner',
            displayName: 'Dono da App',
            identifiers: [
              {
                kind: 'whatsapp_jid',
                value: '351910000099@s.whatsapp.net',
              },
            ],
            globalRoles: ['app_owner'],
            createdAt: '2026-03-26T19:10:00.000Z',
            updatedAt: '2026-03-26T19:10:00.000Z',
          },
          {
            personId: 'person-ana',
            displayName: 'Ana Formadora',
            identifiers: teacherIdentifiers,
            globalRoles: ['member'],
            createdAt: '2026-03-26T19:10:00.000Z',
            updatedAt: '2026-03-26T19:10:00.000Z',
          },
          {
            personId: 'person-student',
            displayName: 'Aluno Teste',
            identifiers: [
              {
                kind: 'whatsapp_jid',
                value: '351910000050@s.whatsapp.net',
              },
            ],
            globalRoles: ['member'],
            createdAt: '2026-03-26T19:10:00.000Z',
            updatedAt: '2026-03-26T19:10:00.000Z',
          },
        ],
        notes: [],
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    rulesFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        rules: [
          {
            ruleId: 'rule-ufcd-programming',
            personId: 'person-ana',
            identifiers: [],
            targetGroupJids: [],
            targetCourseIds: [],
            targetDisciplineCodes: ['UFCD-0777'],
            enabled: true,
            requiresConfirmation: false,
            notes: null,
            createdAt: '2026-03-26T19:10:00.000Z',
            updatedAt: '2026-03-26T19:10:00.000Z',
          },
          {
            ruleId: 'rule-follow-up',
            personId: null,
            identifiers: teacherIdentifiers,
            targetGroupJids: [newGroupJid],
            targetCourseIds: [],
            targetDisciplineCodes: [],
            enabled: true,
            requiresConfirmation: true,
            notes: null,
            createdAt: '2026-03-26T19:10:00.000Z',
            updatedAt: '2026-03-26T19:10:00.000Z',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  const groupDirectory = new GroupDirectoryModule({
    dataRootPath,
    groupSeedFilePath,
  });
  const peopleMemory = new PeopleMemoryModule({
    peopleFilePath,
  });

  await groupDirectory.refreshFromWhatsApp(
    [
      {
        groupJid: newGroupJid,
        subject: 'Canal de Fanout Experimental',
        aliases: ['Fanout'],
      },
    ],
    new Date('2026-03-26T19:12:00.000Z'),
  );

  const audienceRouting = new AudienceRoutingModule({
    dataRootPath,
    groupSeedFilePath,
    catalogFilePath,
    peopleFilePath,
    rulesFilePath,
  });
  const commandPolicy = new CommandPolicyModule({
    groupDirectory,
    peopleMemory,
    settings: {
      authorizedGroupJids: [groupProgrammingA, groupProgrammingB, groupCyber, newGroupJid],
      authorizedPrivateJids: ['351910000099@s.whatsapp.net'],
      directRepliesEnabled: false,
    },
  });
  const instructionQueue = new InstructionQueueModule({
    dataRootPath,
    actionExecutor: {
      async execute(action) {
        const currentAttempts = executionAttempts.get(action.targetGroupJid) ?? 0;
        executionAttempts.set(action.targetGroupJid, currentAttempts + 1);

        if (action.targetGroupJid === groupProgrammingB && action.attemptCount === 1) {
          throw new Error('Simulated delivery failure for one target.');
        }

        return {
          externalMessageId: `wamid:${action.dedupeKey}`,
          note: `sent:${action.targetGroupJid}`,
        };
      },
    },
  });
  const ownerControl = new OwnerControlModule({
    commandPolicy,
    peopleMemory,
    groupDirectory,
    instructionQueue,
    commandExecutor: {
      async execute(command) {
        return {
          stdout: `ran:${command}`,
          stderr: '',
          exitCode: 0,
          signal: null,
          timedOut: false,
        };
      },
    },
  });
  const intentClassifier = new IntentClassifierModule();

  const preview = await audienceRouting.previewDistributionPlan('wamid.wave7.001', {
    identifiers: teacherIdentifiers,
    messageText: 'Distribui UFCD-0777 pelas turmas de programacao.',
  });
  assert.equal(preview.targetCount, 3);
  assert.equal(preview.targets.every((target) => target.dedupeKey === `wamid.wave7.001:${target.groupJid}`), true);

  const dryRunInstruction = await instructionQueue.enqueueDistributionPlan({
    plan: preview,
    messageText: 'dry run distribution',
    mode: 'dry_run',
  });
  assert.equal(dryRunInstruction.actions.length, 3);
  await instructionQueue.tickWorker(new Date('2026-03-26T19:13:00.000Z'));

  let instructions = await instructionQueue.listInstructions();
  let dryRunPersisted = instructions.find((instruction) => instruction.instructionId === dryRunInstruction.instructionId);
  assert.ok(dryRunPersisted);
  assert.equal(dryRunPersisted.status, 'completed');
  assert.equal(dryRunPersisted.actions.every((action) => action.result?.note === 'dry-run'), true);

  const confirmedPreview = await audienceRouting.previewDistributionPlan('wamid.wave7.002', {
    identifiers: teacherIdentifiers,
    messageText: 'Distribui UFCD-0777 pelas turmas de programacao.',
  });
  const confirmedInstruction = await instructionQueue.enqueueDistributionPlan({
    plan: confirmedPreview,
    messageText: 'confirmed distribution',
    mode: 'confirmed',
  });
  const duplicateInstruction = await instructionQueue.enqueueDistributionPlan({
    plan: confirmedPreview,
    messageText: 'confirmed distribution',
    mode: 'confirmed',
  });
  assert.equal(duplicateInstruction.actions.every((action) => action.status === 'skipped'), true);

  await instructionQueue.tickWorker(new Date('2026-03-26T19:14:00.000Z'));
  instructions = await instructionQueue.listInstructions();
  const confirmedPersisted = instructions.find((instruction) => instruction.instructionId === confirmedInstruction.instructionId);
  assert.ok(confirmedPersisted);
  assert.equal(confirmedPersisted.status, 'partial_failed');
  assert.equal(confirmedPersisted.actions.filter((action) => action.status === 'completed').length, 2);
  assert.equal(confirmedPersisted.actions.filter((action) => action.status === 'failed').length, 1);
  assert.equal(executionAttempts.get(groupProgrammingA), 1);
  assert.equal(executionAttempts.get(groupProgrammingB), 1);
  assert.equal(executionAttempts.get(newGroupJid), 1);

  assert.equal(await commandPolicy.getCalendarAccessMode(groupProgrammingA, 'person-student'), 'read');
  assert.equal(await commandPolicy.canManageCalendar(groupProgrammingA, 'person-student', 'read'), true);
  assert.equal(await commandPolicy.canManageCalendar(groupProgrammingA, 'person-student', 'read_write'), false);
  assert.equal(await commandPolicy.getCalendarAccessMode(groupProgrammingA, 'person-ana'), 'read_write');
  assert.equal(await commandPolicy.canManageCalendar(groupProgrammingA, 'person-ana', 'read_write'), true);
  assert.equal(await commandPolicy.canManageCalendar(groupCyber, 'person-ana', 'read_write'), false);
  assert.equal(await commandPolicy.canUseOwnerTerminal('person-app-owner'), true);
  assert.equal(await commandPolicy.canUseOwnerTerminal('person-ana'), false);

  const queueListAsGroupOwner = await ownerControl.executeOwnerCommand({
    personId: 'person-ana',
    groupJid: groupProgrammingA,
    messageText: '!queue list',
  });
  assert.equal(queueListAsGroupOwner.accepted, true);
  assert.equal(queueListAsGroupOwner.visibleInstructions.every((instruction) =>
    instruction.actions.every((action) => action.targetGroupJid === groupProgrammingA),
  ), true);

  const terminalAsGroupOwner = await ownerControl.executeOwnerCommand({
    personId: 'person-ana',
    groupJid: groupProgrammingA,
    messageText: '!term printf nope',
  });
  assert.equal(terminalAsGroupOwner.accepted, false);

  const terminalAsAppOwner = await ownerControl.executeOwnerCommand({
    personId: 'person-app-owner',
    messageText: '!term printf ok',
  });
  assert.equal(terminalAsAppOwner.accepted, true);
  assert.equal(terminalAsAppOwner.output.includes('ran:printf ok'), true);

  const groupOwnerRetry = await ownerControl.executeOwnerCommand({
    personId: 'person-ana',
    groupJid: groupProgrammingA,
    messageText: `!queue retry ${confirmedInstruction.instructionId}`,
  });
  assert.equal(groupOwnerRetry.accepted, false);

  const appOwnerRetry = await ownerControl.executeOwnerCommand({
    personId: 'person-app-owner',
    messageText: `!queue retry ${confirmedInstruction.instructionId}`,
  });
  assert.equal(appOwnerRetry.accepted, true);

  await instructionQueue.tickWorker(new Date('2026-03-26T19:15:00.000Z'));
  instructions = await instructionQueue.listInstructions();
  const completedInstruction = instructions.find((instruction) => instruction.instructionId === confirmedInstruction.instructionId);
  assert.ok(completedInstruction);
  assert.equal(completedInstruction.status, 'completed');
  assert.equal(executionAttempts.get(groupProgrammingA), 1);
  assert.equal(executionAttempts.get(groupProgrammingB), 2);
  assert.equal(executionAttempts.get(newGroupJid), 1);

  assert.equal(ownerControl.detectOwnerCommand('!queue list')?.kind, 'queue_list');
  assert.equal(ownerControl.detectOwnerCommand('!calendar access 120@g.us')?.kind, 'calendar_access');

  assert.equal(intentClassifier.classifyMessage({ text: '!term pwd' }).intent, 'owner_command');
  assert.equal(
    intentClassifier.classifyMessage({ text: 'distribui este aviso pelas turmas de programacao' }).intent,
    'fanout_request',
  );
  const scheduleIntent = intentClassifier.classifyMessage({ text: 'marca aula amanhã às 10' });
  assert.equal(scheduleIntent.intent, 'scheduling_request');
  assert.equal(scheduleIntent.requestedAccessMode, 'read_write');
  assert.equal(
    intentClassifier.classifyMessage({ text: 'resume o que aconteceu hoje no grupo' }).intent,
    'local_summary_request',
  );

  console.log(`Wave 7 validation passed in ${sandboxPath}`);
} finally {
  await rm(sandboxPath, { recursive: true, force: true });
}
