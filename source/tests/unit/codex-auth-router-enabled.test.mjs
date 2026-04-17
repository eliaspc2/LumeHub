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

test('codex auth router can disable token switching while keeping canonical auth usable', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-enabled-'));
  const canonicalAuthFilePath = join(sandboxPath, 'auth.json');
  const secondaryAuthFilePath = join(sandboxPath, 'secondary.json');
  const stateFilePath = join(sandboxPath, 'runtime', 'codex-auth-router.state.json');
  const backupDirectoryPath = join(sandboxPath, 'backups');

  try {
    await mkdir(join(sandboxPath, 'runtime'), { recursive: true });
    await writeFile(canonicalAuthFilePath, '{"token":"canonical"}', 'utf8');
    await writeFile(secondaryAuthFilePath, '{"token":"secondary"}', 'utf8');

    const repository = new CodexAccountRepository({
      canonicalAuthFilePath,
      stateFilePath,
      backupDirectoryPath,
      sourceAccounts: [
        {
          accountId: 'secondary',
          label: 'Secondary',
          filePath: secondaryAuthFilePath,
        },
      ],
    });
    const writer = new CodexAuthCanonicalWriter({
      canonicalAuthFilePath,
      backupDirectoryPath,
    });
    const service = new CodexAuthRouterService(repository, writer);

    const disabledStatus = await service.setEnabled(false);
    const preparedSelection = await service.prepareAuthForRequest({
      reason: 'unit_disabled_prepare',
      now: new Date('2026-04-17T09:00:00.000Z'),
    });

    assert.equal(disabledStatus.enabled, false);
    assert.equal(preparedSelection.accountId, 'canonical-live');
    assert.equal(preparedSelection.switchPerformed, false);
    assert.equal(await readFile(canonicalAuthFilePath, 'utf8'), '{"token":"canonical"}');

    await assert.rejects(
      service.forceSwitch('secondary', {
        reason: 'unit_disabled_switch',
        now: new Date('2026-04-17T09:01:00.000Z'),
      }),
      /switching is disabled/i,
    );

    const enabledStatus = await service.setEnabled(true);
    const switchedSelection = await service.forceSwitch('secondary', {
      reason: 'unit_enabled_switch',
      now: new Date('2026-04-17T09:02:00.000Z'),
    });

    assert.equal(enabledStatus.enabled, true);
    assert.equal(switchedSelection.accountId, 'secondary');
    assert.equal(await readFile(canonicalAuthFilePath, 'utf8'), '{"token":"secondary"}');
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});
