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

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave6-'));

try {
  const dataRootPath = join(sandboxPath, 'data');
  const configRootPath = join(sandboxPath, 'config');
  const groupSeedFilePath = join(configRootPath, 'groups.json');
  const catalogFilePath = join(configRootPath, 'discipline_catalog.json');
  const peopleFilePath = join(configRootPath, 'people.json');
  const rulesFilePath = join(configRootPath, 'audience_rules.json');
  const newGroupJid = '120363499999999999@g.us';
  const groupProgrammingA = '120363402446203704@g.us';
  const groupProgrammingB = '120363402446203705@g.us';
  const groupCyber = '120363407086801381@g.us';
  const teacherIdentifiers = [
    {
      kind: 'whatsapp_jid',
      value: '351910000001@s.whatsapp.net',
    },
  ];

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
            aliases: ['Programacao A', 'EFA PI A'],
            courseId: 'course-programming',
            groupOwners: [
              {
                personId: 'person-ana',
                assignedAt: '2026-03-26T18:40:00.000Z',
                assignedBy: 'person-app-owner',
              },
            ],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            lastRefreshedAt: '2026-03-26T18:40:00.000Z',
          },
          {
            groupJid: groupProgrammingB,
            preferredSubject: 'EFA Programador/a de Informatica - Turma B',
            aliases: ['Programacao B', 'EFA PI B'],
            courseId: 'course-programming',
            groupOwners: [],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            lastRefreshedAt: '2026-03-26T18:40:00.000Z',
          },
          {
            groupJid: groupCyber,
            preferredSubject: 'CET Ciberseguranca',
            aliases: ['Cyber', 'Ciber'],
            courseId: 'course-cyber',
            groupOwners: [
              {
                personId: 'person-rui',
                assignedAt: '2026-03-26T18:40:00.000Z',
                assignedBy: 'person-app-owner',
              },
            ],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read',
              appOwner: 'read_write',
            },
            lastRefreshedAt: '2026-03-26T18:40:00.000Z',
          },
          {
            groupJid: '120363400000000001@g.us',
            preferredSubject: 'Sala de Coordenacao',
            aliases: ['Coordenacao'],
            courseId: null,
            groupOwners: [],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            lastRefreshedAt: '2026-03-26T18:40:00.000Z',
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
            aliases: ['0777', 'programacao base'],
          },
          {
            code: 'UC-SEG',
            title: 'Seguranca Aplicada',
            courseId: 'course-cyber',
            aliases: ['seguranca aplicada'],
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
            createdAt: '2026-03-26T18:40:00.000Z',
            updatedAt: '2026-03-26T18:40:00.000Z',
          },
          {
            personId: 'person-ana',
            displayName: 'Ana Formadora',
            identifiers: teacherIdentifiers,
            globalRoles: ['member'],
            createdAt: '2026-03-26T18:40:00.000Z',
            updatedAt: '2026-03-26T18:40:00.000Z',
          },
          {
            personId: 'person-rui',
            displayName: 'Rui Coordenador',
            identifiers: [
              {
                kind: 'whatsapp_jid',
                value: '351910000002@s.whatsapp.net',
              },
            ],
            globalRoles: ['member'],
            createdAt: '2026-03-26T18:40:00.000Z',
            updatedAt: '2026-03-26T18:40:00.000Z',
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
            notes: 'Distribuicao base da formadora para as turmas de programacao.',
            createdAt: '2026-03-26T18:40:00.000Z',
            updatedAt: '2026-03-26T18:40:00.000Z',
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
            notes: 'Canal extra para testes de fan-out.',
            createdAt: '2026-03-26T18:40:00.000Z',
            updatedAt: '2026-03-26T18:40:00.000Z',
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
  const audienceRouting = new AudienceRoutingModule({
    dataRootPath,
    groupSeedFilePath,
    catalogFilePath,
    peopleFilePath,
    rulesFilePath,
  });

  const seededGroups = await groupDirectory.listGroups();
  assert.equal(seededGroups.length, 4);

  const refreshed = await groupDirectory.refreshFromWhatsApp(
    [
      {
        groupJid: newGroupJid,
        subject: 'Canal de Fanout Experimental',
        aliases: ['Fanout Teste'],
      },
    ],
    new Date('2026-03-26T19:05:00.000Z'),
  );
  assert.equal(refreshed.length, 1);
  assert.equal(refreshed[0].groupJid, newGroupJid);
  assert.equal((await groupDirectory.listGroups()).length, 5);

  const teacher = await peopleMemory.findByIdentifiers(teacherIdentifiers);
  const appOwner = await peopleMemory.findByIdentifiers([
    {
      kind: 'whatsapp_jid',
      value: '351910000099@s.whatsapp.net',
    },
  ]);
  assert.ok(teacher);
  assert.ok(appOwner);
  assert.equal(await peopleMemory.isAppOwner(teacher.personId), false);
  assert.equal(await peopleMemory.isAppOwner(appOwner.personId), true);
  assert.equal(await groupDirectory.isGroupOwner(groupProgrammingA, teacher.personId), true);
  assert.equal(await groupDirectory.isGroupOwner(groupProgrammingA, appOwner.personId), false);

  const programmingPolicy = await groupDirectory.getCalendarAccessPolicy(groupProgrammingA);
  assert.deepEqual(programmingPolicy, {
    group: 'read',
    groupOwner: 'read_write',
    appOwner: 'read_write',
  });
  assert.equal(resolveCalendarAccess(programmingPolicy, false, false), 'read');
  assert.equal(resolveCalendarAccess(programmingPolicy, true, false), 'read_write');
  assert.equal(resolveCalendarAccess(programmingPolicy, false, true), 'read_write');

  const resolved = await audienceRouting.resolveTargetsForSender({
    identifiers: teacherIdentifiers,
    messageText: 'Partilhem os materiais da UFCD-0777 com as turmas de programacao.',
  });
  assert.equal(resolved.senderPersonId, 'person-ana');
  assert.equal(resolved.senderDisplayName, 'Ana Formadora');
  assert.deepEqual(resolved.matchedRuleIds, ['rule-follow-up', 'rule-ufcd-programming']);
  assert.deepEqual(resolved.matchedDisciplineCodes, ['UFCD-0777']);
  assert.equal(resolved.requiresConfirmation, true);
  assert.deepEqual(
    resolved.targets.map((target) => target.groupJid),
    [newGroupJid, groupProgrammingA, groupProgrammingB],
  );

  const preview = await audienceRouting.previewDistributionPlan('wamid.wave6.001', {
    identifiers: teacherIdentifiers,
    messageText: 'Partilhem os materiais da UFCD-0777 com as turmas de programacao.',
  });
  assert.equal(preview.targetCount, 3);
  assert.equal(preview.targets.every((target) => target.dedupeKey === `wamid.wave6.001:${target.groupJid}`), true);
  assert.equal(preview.requiresConfirmation, true);

  await audienceRouting.upsertSenderAudienceRule({
    personId: 'person-ana',
    targetGroupJids: [groupProgrammingA],
    notes: 'Refino manual para testar dedupe.',
  });

  const rules = await audienceRouting.listSenderAudienceRules();
  assert.equal(rules.length, 3);

  const previewAfterUpsert = await audienceRouting.previewDistributionPlan('wamid.wave6.002', {
    identifiers: teacherIdentifiers,
    messageText: 'Partilhem os materiais da UFCD-0777 com as turmas de programacao.',
  });
  assert.equal(previewAfterUpsert.targetCount, 3);
  const duplicatedTarget = previewAfterUpsert.targets.find((target) => target.groupJid === groupProgrammingA);
  assert.ok(duplicatedTarget);
  assert.equal(duplicatedTarget.reasons.includes(`group:${groupProgrammingA}`), true);
  assert.equal(duplicatedTarget.reasons.includes('discipline:UFCD-0777'), true);

  console.log(`Wave 6 validation passed in ${sandboxPath}`);
} finally {
  await rm(sandboxPath, { recursive: true, force: true });
}

function resolveCalendarAccess(policy, isGroupOwner, isAppOwner) {
  if (isAppOwner) {
    return policy.appOwner;
  }

  if (isGroupOwner) {
    return policy.groupOwner;
  }

  return policy.group;
}
