import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { GroupPathResolver } = await import(
  '../../packages/adapters/persistence-group-files/dist/index.js'
);
const { GroupRepository } = await import(
  '../../packages/modules/group-directory/dist/modules/group-directory/src/infrastructure/persistence/GroupRepository.js'
);

test('persisted group owners override seed owners so the group page can set the operational owner', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-group-repository-'));
  try {
    const groupSeedFilePath = join(sandboxPath, 'groups.json');
    const pathResolver = new GroupPathResolver({
      dataRootPath: join(sandboxPath, 'data'),
    });
    const repository = new GroupRepository({
      pathResolver,
      groupSeedFilePath,
    });

    await writeFile(
      groupSeedFilePath,
      JSON.stringify({
        schemaVersion: 1,
        groups: [
          {
            groupJid: '120363402446203704@g.us',
            preferredSubject: 'EFA Programacao A',
            aliases: ['Programacao A'],
            courseId: 'efa-programacao-a',
            groupOwners: [
              {
                personId: 'person-app-owner',
                assignedAt: '2026-04-06T08:00:00.000Z',
                assignedBy: 'validator',
              },
            ],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            operationalSettings: {
              mode: 'com_agendamento',
              schedulingEnabled: true,
              allowLlmScheduling: true,
              memberTagPolicy: 'members_can_tag',
            },
            lastRefreshedAt: '2026-04-06T08:00:00.000Z',
          },
        ],
      }),
      'utf8',
    );

    await repository.saveGroup({
      groupJid: '120363402446203704@g.us',
      preferredSubject: 'EFA Programacao A',
      aliases: ['Programacao A'],
      courseId: 'efa-programacao-a',
      groupOwners: [
        {
          personId: 'person-maria',
          assignedAt: '2026-04-06T09:00:00.000Z',
          assignedBy: 'test',
        },
      ],
      calendarAccessPolicy: {
        group: 'read',
        groupOwner: 'read_write',
        appOwner: 'read_write',
      },
      operationalSettings: {
        mode: 'com_agendamento',
        schedulingEnabled: true,
        allowLlmScheduling: true,
        memberTagPolicy: 'members_can_tag',
      },
      lastRefreshedAt: '2026-04-06T09:00:00.000Z',
    });

    const group = await repository.findByJid('120363402446203704@g.us');
    assert.ok(group);
    assert.deepEqual(
      group.groupOwners.map((owner) => owner.personId),
      ['person-maria'],
    );
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});
