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

test('codex auth router syncs refreshed canonical auth back before switching away', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-sync-back-'));
  const canonicalAuthFilePath = join(sandboxPath, 'auth.json');
  const accountAFilePath = join(sandboxPath, 'secondary', 'account-a', 'auth.json');
  const accountBFilePath = join(sandboxPath, 'secondary', 'account-b', 'auth.json');
  const stateFilePath = join(sandboxPath, 'runtime', 'codex-auth-router.state.json');
  const backupDirectoryPath = join(sandboxPath, 'backups');

  try {
    await mkdir(join(sandboxPath, 'runtime'), { recursive: true });
    await mkdir(join(sandboxPath, 'secondary', 'account-a'), { recursive: true });
    await mkdir(join(sandboxPath, 'secondary', 'account-b'), { recursive: true });
    await writeFile(canonicalAuthFilePath, authJson('account-a', 'refreshed-live'), 'utf8');
    await writeFile(accountAFilePath, authJson('account-a', 'stale-secondary-copy'), 'utf8');
    await writeFile(accountBFilePath, authJson('account-b', 'reserve-b'), 'utf8');

    const repository = new CodexAccountRepository({
      canonicalAuthFilePath,
      stateFilePath,
      backupDirectoryPath,
      sourceAccounts: [
        {
          accountId: 'account-a',
          label: 'Account A',
          filePath: accountAFilePath,
          priority: 1,
        },
        {
          accountId: 'account-b',
          label: 'Account B',
          filePath: accountBFilePath,
          priority: 2,
        },
      ],
    });
    const writer = new CodexAuthCanonicalWriter({
      canonicalAuthFilePath,
      backupDirectoryPath,
    });
    const service = new CodexAuthRouterService(repository, writer);

    await service.forceSwitch('account-b', {
      reason: 'unit_switch_to_b',
      now: new Date('2026-04-22T09:00:00.000Z'),
    });

    assert.equal(await readFile(accountAFilePath, 'utf8'), authJson('account-a', 'refreshed-live'));
    assert.equal(await readFile(canonicalAuthFilePath, 'utf8'), authJson('account-b', 'reserve-b'));
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

test('codex auth router never overwrites a refreshed canonical token with its stale source copy', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-sync-same-'));
  const canonicalAuthFilePath = join(sandboxPath, 'auth.json');
  const accountAFilePath = join(sandboxPath, 'secondary', 'account-a', 'auth.json');
  const stateFilePath = join(sandboxPath, 'runtime', 'codex-auth-router.state.json');
  const backupDirectoryPath = join(sandboxPath, 'backups');

  try {
    await mkdir(join(sandboxPath, 'runtime'), { recursive: true });
    await mkdir(join(sandboxPath, 'secondary', 'account-a'), { recursive: true });
    await writeFile(canonicalAuthFilePath, authJson('account-a', 'refreshed-live'), 'utf8');
    await writeFile(accountAFilePath, authJson('account-a', 'stale-secondary-copy'), 'utf8');

    const repository = new CodexAccountRepository({
      canonicalAuthFilePath,
      stateFilePath,
      backupDirectoryPath,
      sourceAccounts: [
        {
          accountId: 'account-a',
          label: 'Account A',
          filePath: accountAFilePath,
          priority: 1,
        },
      ],
    });
    const writer = new CodexAuthCanonicalWriter({
      canonicalAuthFilePath,
      backupDirectoryPath,
    });
    const service = new CodexAuthRouterService(repository, writer);

    const selection = await service.forceSwitch('account-a', {
      reason: 'unit_switch_same_account',
      now: new Date('2026-04-22T09:05:00.000Z'),
    });

    assert.equal(selection.switchPerformed, false);
    assert.equal(await readFile(accountAFilePath, 'utf8'), authJson('account-a', 'refreshed-live'));
    assert.equal(await readFile(canonicalAuthFilePath, 'utf8'), authJson('account-a', 'refreshed-live'));
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

test('codex auth router treats canonical live as the active slot, not as a third token', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-identity-dedupe-'));
  const canonicalAuthFilePath = join(sandboxPath, 'auth.json');
  const accountAFilePath = join(sandboxPath, 'secondary', 'account-a', 'auth.json');
  const accountBFilePath = join(sandboxPath, 'secondary', 'account-b', 'auth.json');
  const stateFilePath = join(sandboxPath, 'runtime', 'codex-auth-router.state.json');
  const backupDirectoryPath = join(sandboxPath, 'backups');

  try {
    await mkdir(join(sandboxPath, 'runtime'), { recursive: true });
    await mkdir(join(sandboxPath, 'secondary', 'account-a'), { recursive: true });
    await mkdir(join(sandboxPath, 'secondary', 'account-b'), { recursive: true });
    await writeFile(canonicalAuthFilePath, authJson('account-a', 'live-copy'), 'utf8');
    await writeFile(accountAFilePath, authJson('account-a', 'secondary-copy'), 'utf8');
    await writeFile(accountBFilePath, authJson('account-b', 'reserve-b'), 'utf8');

    const repository = new CodexAccountRepository({
      canonicalAuthFilePath,
      stateFilePath,
      backupDirectoryPath,
      sourceAccounts: [
        {
          accountId: 'account-a',
          label: 'Account A',
          filePath: accountAFilePath,
          priority: 1,
        },
        {
          accountId: 'account-b',
          label: 'Account B',
          filePath: accountBFilePath,
          priority: 2,
        },
      ],
    });
    const writer = new CodexAuthCanonicalWriter({
      canonicalAuthFilePath,
      backupDirectoryPath,
    });
    const service = new CodexAuthRouterService(repository, writer);
    const status = await service.getStatus();

    assert.equal(status.canonicalExists, true);
    assert.equal(status.accountCount, 2);
    assert.deepEqual(
      status.accounts.map((account) => account.accountId),
      ['account-a', 'account-b'],
    );
    assert.equal(status.currentSelection?.accountId, 'account-a');
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

test('codex auth router shows the real live account when persisted selection is stale', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-visible-live-'));
  const canonicalAuthFilePath = join(sandboxPath, 'auth.json');
  const accountAFilePath = join(sandboxPath, 'secondary', 'account-a', 'auth.json');
  const accountBFilePath = join(sandboxPath, 'secondary', 'account-b', 'auth.json');
  const stateFilePath = join(sandboxPath, 'runtime', 'codex-auth-router.state.json');
  const backupDirectoryPath = join(sandboxPath, 'backups');

  try {
    await mkdir(join(sandboxPath, 'runtime'), { recursive: true });
    await mkdir(join(sandboxPath, 'secondary', 'account-a'), { recursive: true });
    await mkdir(join(sandboxPath, 'secondary', 'account-b'), { recursive: true });
    await writeFile(canonicalAuthFilePath, authJson('account-b', 'live-b'), 'utf8');
    await writeFile(accountAFilePath, authJson('account-a', 'secondary-a'), 'utf8');
    await writeFile(accountBFilePath, authJson('account-b', 'secondary-b'), 'utf8');
    await writeFile(
      stateFilePath,
      JSON.stringify({
        schemaVersion: 1,
        enabled: true,
        currentSelection: {
          accountId: 'account-a',
          label: 'Account A',
          sourceFilePath: accountAFilePath,
          canonicalAuthFilePath,
          selectedAt: '2026-04-22T08:00:00.000Z',
          switchPerformed: false,
          backupFilePath: null,
          reason: 'old_state',
          contentHash: null,
        },
        accountStates: {},
        switchHistory: [],
        lastPreparedAt: null,
        lastSwitchAt: null,
        lastError: null,
        updatedAt: null,
      }),
      'utf8',
    );

    const repository = new CodexAccountRepository({
      canonicalAuthFilePath,
      stateFilePath,
      backupDirectoryPath,
      sourceAccounts: [
        {
          accountId: 'account-a',
          label: 'Account A',
          filePath: accountAFilePath,
          priority: 1,
        },
        {
          accountId: 'account-b',
          label: 'Account B',
          filePath: accountBFilePath,
          priority: 2,
        },
      ],
    });
    const writer = new CodexAuthCanonicalWriter({
      canonicalAuthFilePath,
      backupDirectoryPath,
    });
    const service = new CodexAuthRouterService(repository, writer);
    const status = await service.getStatus();

    assert.equal(status.currentSelection?.accountId, 'account-b');
    assert.equal(status.currentSelection?.reason, 'canonical_live_detected');
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

function authJson(accountId, marker) {
  return JSON.stringify({
    auth_mode: 'chatgpt',
    tokens: {
      account_id: accountId,
      id_token: `id-${marker}`,
      access_token: `access-${marker}`,
      refresh_token: `refresh-${marker}`,
    },
  });
}
