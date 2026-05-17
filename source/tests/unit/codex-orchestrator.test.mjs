import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { CodexOrchestratorModule, normaliseWhatsAppPhoneToJid } = await import(
  '../../packages/modules/codex-orchestrator/dist/modules/codex-orchestrator/src/public/index.js'
);

test('normalises admin phone file values to WhatsApp JIDs', () => {
  assert.equal(normaliseWhatsAppPhoneToJid('+351 910 000 000'), '351910000000@s.whatsapp.net');
  assert.equal(normaliseWhatsAppPhoneToJid('351910000000@s.whatsapp.net'), '351910000000@s.whatsapp.net');
  assert.equal(normaliseWhatsAppPhoneToJid('351910000000:15@s.whatsapp.net'), '351910000000@s.whatsapp.net');
});

test('syncs admin and locks assistant to admin plus scheduling groups', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-orchestrator-'));

  try {
    const dataRootPath = join(sandboxPath, 'data');
    const configRootPath = join(dataRootPath, 'config');
    const adminPhoneFilePath = join(configRootPath, 'admin-phone.txt');
    await mkdir(configRootPath, { recursive: true });
    await writeFile(adminPhoneFilePath, '+351910000000\n', 'utf8');
    await writeFile(
      join(configRootPath, 'groups.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          groups: [
            buildGroup('120363000000001@g.us', 'Turma com agenda', 'com_agendamento', true),
            buildGroup('120363000000002@g.us', 'Distribuicao', 'distribuicao_apenas', true),
            buildGroup('120363000000003@g.us', 'Agenda desligada', 'com_agendamento', false),
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    const orchestrator = new CodexOrchestratorModule({
      projectRoot: sandboxPath,
      dataRootPath,
      adminPhoneFilePath,
    });

    const admin = await orchestrator.syncAdminFromPhoneFile();
    assert.equal(admin.adminJid, '351910000000@s.whatsapp.net');
    assert.equal(admin.personId, 'app-owner-whatsapp-admin');

    const lockdown = await orchestrator.lockdownToAdminAndScheduledGroups();
    assert.deepEqual(lockdown.authorizedPrivateJids, ['351910000000@s.whatsapp.net']);
    assert.deepEqual(lockdown.authorizedGroupJids, ['120363000000001@g.us']);

    await orchestrator.upsertGroupPrompt({
      groupJid: '120363000000001@g.us',
      content: 'Responder so sobre agendamentos deste grupo.',
    });

    const status = await orchestrator.status();
    assert.equal(status.admin.appOwner, true);
    assert.equal(status.groups.find((group) => group.groupJid === '120363000000001@g.us')?.promptExists, true);

    const prompt = await readFile(
      join(dataRootPath, 'groups', '120363000000001@g.us', 'llm', 'instructions.md'),
      'utf8',
    );
    assert.equal(prompt, 'Responder so sobre agendamentos deste grupo.\n');
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

function buildGroup(groupJid, preferredSubject, mode, schedulingEnabled) {
  return {
    groupJid,
    preferredSubject,
    aliases: [],
    courseId: null,
    groupOwners: [],
    calendarAccessPolicy: {
      group: 'read',
      groupOwner: 'read_write',
      appOwner: 'read_write',
    },
    operationalSettings: {
      mode,
      schedulingEnabled,
      allowLlmScheduling: schedulingEnabled,
      memberTagPolicy: 'members_can_tag',
    },
    lastRefreshedAt: null,
  };
}
