import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { CodexAuthRouterService } = await import(
  '../../packages/modules/codex-auth-router/dist/modules/codex-auth-router/src/application/services/CodexAuthRouterService.js'
);
const { CodexAccountRepository } = await import(
  '../../packages/modules/codex-auth-router/dist/modules/codex-auth-router/src/infrastructure/persistence/CodexAccountRepository.js'
);
const { CodexAuthCanonicalWriter } = await import(
  '../../packages/modules/codex-auth-router/dist/modules/codex-auth-router/src/domain/services/CodexAuthCanonicalWriter.js'
);

test('codex auth router supports more than two explicit token sources', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-multi-'));
  const canonicalAuthFilePath = join(sandboxPath, 'auth.json');
  const reserveAFilePath = join(sandboxPath, 'reserve-a.json');
  const reserveBFilePath = join(sandboxPath, 'reserve-b.json');
  const stateFilePath = join(sandboxPath, 'runtime', 'codex-auth-router.state.json');
  const backupDirectoryPath = join(sandboxPath, 'backups');

  try {
    await mkdir(join(sandboxPath, 'runtime'), { recursive: true });
    await writeFile(canonicalAuthFilePath, '{"token":"canonical"}', 'utf8');
    await writeFile(reserveAFilePath, '{"token":"reserve-a"}', 'utf8');
    await writeFile(reserveBFilePath, '{"token":"reserve-b"}', 'utf8');

    const repository = new CodexAccountRepository({
      canonicalAuthFilePath,
      stateFilePath,
      backupDirectoryPath,
      sourceAccounts: [
        {
          accountId: 'reserve-a',
          label: 'Reserve A',
          filePath: reserveAFilePath,
          priority: 1,
        },
        {
          accountId: 'reserve-b',
          label: 'Reserve B',
          filePath: reserveBFilePath,
          priority: 2,
        },
      ],
    });
    const writer = new CodexAuthCanonicalWriter({
      canonicalAuthFilePath,
      backupDirectoryPath,
    });
    const service = new CodexAuthRouterService(repository, writer);

    const initialStatus = await service.getStatus();
    assert.equal(initialStatus.accounts.length, 3);
    assert.equal(initialStatus.accountCount, 3);

    const switchedSelection = await service.forceSwitch('reserve-b', {
      reason: 'unit_multi_switch',
      now: new Date('2026-04-17T09:05:00.000Z'),
    });
    const finalStatus = await service.getStatus();

    assert.equal(switchedSelection.accountId, 'reserve-b');
    assert.equal(finalStatus.currentSelection?.accountId, 'reserve-b');
    assert.equal(finalStatus.accountCount, 3);
    assert.equal(await readFile(canonicalAuthFilePath, 'utf8'), '{"token":"reserve-b"}');
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});
