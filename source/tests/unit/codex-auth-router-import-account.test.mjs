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
const { CodexAccountQuotaService } = await import(
  '../../packages/modules/codex-auth-router/dist/modules/codex-auth-router/src/domain/services/CodexAccountQuotaService.js'
);

test('codex auth router can import a new managed token and persist it for future restarts', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-import-'));
  const canonicalAuthFilePath = join(sandboxPath, 'auth.json');
  const stateFilePath = join(sandboxPath, 'runtime', 'codex-auth-router.state.json');
  const backupDirectoryPath = join(sandboxPath, 'backups');
  const managedAccountsDirectoryPath = join(sandboxPath, 'secondary');
  const sourcesEnvironmentFilePath = join(sandboxPath, 'codex-auth-sources.env');

  try {
    await mkdir(join(sandboxPath, 'runtime'), { recursive: true });
    await writeFile(canonicalAuthFilePath, authJson('canonical-account', 'canonical-live'), 'utf8');

    const repository = new CodexAccountRepository({
      canonicalAuthFilePath,
      stateFilePath,
      backupDirectoryPath,
      sourcesEnvironmentFilePath,
      managedAccountsDirectoryPath,
    });
    const writer = new CodexAuthCanonicalWriter({
      canonicalAuthFilePath,
      backupDirectoryPath,
    });
    const service = new CodexAuthRouterService(repository, writer);

    const imported = await service.importAccount({
      authJson: authJson('account-a', 'fresh-import'),
      label: 'Conta A',
    });
    const status = await service.getStatus();
    const managedAuthFilePath = join(managedAccountsDirectoryPath, 'account-a', 'auth.json');

    assert.equal(imported.accountId, 'account-a');
    assert.equal(imported.label, 'Conta A');
    assert.equal(imported.created, true);
    assert.equal(imported.sourceFilePath, managedAuthFilePath);
    assert.equal(await readFile(managedAuthFilePath, 'utf8'), authJson('account-a', 'fresh-import'));
    assert.match(await readFile(sourcesEnvironmentFilePath, 'utf8'), /account-a/u);
    assert.equal(status.accounts.some((account) => account.accountId === 'account-a'), true);
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

test('codex auth router updates an existing managed token without duplicating the account', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-import-update-'));
  const canonicalAuthFilePath = join(sandboxPath, 'auth.json');
  const stateFilePath = join(sandboxPath, 'runtime', 'codex-auth-router.state.json');
  const backupDirectoryPath = join(sandboxPath, 'backups');
  const managedAccountsDirectoryPath = join(sandboxPath, 'secondary');
  const sourcesEnvironmentFilePath = join(sandboxPath, 'codex-auth-sources.env');
  const existingAccountFilePath = join(managedAccountsDirectoryPath, 'account-a', 'auth.json');

  try {
    await mkdir(join(sandboxPath, 'runtime'), { recursive: true });
    await mkdir(join(managedAccountsDirectoryPath, 'account-a'), { recursive: true });
    await writeFile(canonicalAuthFilePath, authJson('canonical-account', 'canonical-live'), 'utf8');
    await writeFile(existingAccountFilePath, authJson('account-a', 'stale-copy'), 'utf8');
    await writeFile(
      sourcesEnvironmentFilePath,
      'LUME_HUB_CODEX_AUTH_SOURCES="[{\\"accountId\\":\\"account-a\\",\\"label\\":\\"Conta A\\",\\"filePath\\":\\"' +
        existingAccountFilePath.replaceAll('\\', '\\\\') +
        '\\",\\"priority\\":1}]"\n',
      'utf8',
    );

    const repository = new CodexAccountRepository({
      canonicalAuthFilePath,
      stateFilePath,
      backupDirectoryPath,
      sourcesEnvironmentFilePath,
      managedAccountsDirectoryPath,
    });
    const writer = new CodexAuthCanonicalWriter({
      canonicalAuthFilePath,
      backupDirectoryPath,
    });
    const service = new CodexAuthRouterService(repository, writer);

    const imported = await service.importAccount({
      authJson: authJson('account-a', 'refreshed-copy'),
      label: 'Conta A renovada',
    });
    const status = await service.getStatus();
    const importedAccounts = status.accounts.filter((account) => account.accountId === 'account-a');

    assert.equal(imported.created, false);
    assert.equal(imported.sourceFilePath, existingAccountFilePath);
    assert.equal(await readFile(existingAccountFilePath, 'utf8'), authJson('account-a', 'refreshed-copy'));
    assert.equal(importedAccounts.length, 1);
    assert.equal(importedAccounts[0]?.label, 'Conta A renovada');
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

test('codex auth router can rename an existing token without changing its file', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-rename-'));
  const canonicalAuthFilePath = join(sandboxPath, 'auth.json');
  const stateFilePath = join(sandboxPath, 'runtime', 'codex-auth-router.state.json');
  const backupDirectoryPath = join(sandboxPath, 'backups');
  const managedAccountsDirectoryPath = join(sandboxPath, 'secondary');
  const sourcesEnvironmentFilePath = join(sandboxPath, 'codex-auth-sources.env');
  const existingAccountFilePath = join(managedAccountsDirectoryPath, 'account-a', 'auth.json');
  const existingMetadataFilePath = join(managedAccountsDirectoryPath, 'account-a', 'meta.json');

  try {
    await mkdir(join(sandboxPath, 'runtime'), { recursive: true });
    await mkdir(join(managedAccountsDirectoryPath, 'account-a'), { recursive: true });
    await writeFile(canonicalAuthFilePath, authJson('canonical-account', 'canonical-live'), 'utf8');
    await writeFile(existingAccountFilePath, authJson('account-a', 'managed-copy'), 'utf8');
    await writeFile(existingMetadataFilePath, JSON.stringify({ accountId: 'account-a', label: 'Conta antiga' }, null, 2), 'utf8');
    await writeFile(
      sourcesEnvironmentFilePath,
      'LUME_HUB_CODEX_AUTH_SOURCES="[{\\"accountId\\":\\"account-a\\",\\"label\\":\\"Conta antiga\\",\\"filePath\\":\\"' +
        existingAccountFilePath.replaceAll('\\', '\\\\') +
        '\\",\\"priority\\":1,\\"kind\\":\\"secondary\\"}]"\n',
      'utf8',
    );

    const repository = new CodexAccountRepository({
      canonicalAuthFilePath,
      stateFilePath,
      backupDirectoryPath,
      sourcesEnvironmentFilePath,
      managedAccountsDirectoryPath,
    });
    const writer = new CodexAuthCanonicalWriter({
      canonicalAuthFilePath,
      backupDirectoryPath,
    });
    const service = new CodexAuthRouterService(repository, writer);

    const renamed = await service.renameAccount({
      accountId: 'account-a',
      label: 'Conta final',
    });
    const status = await service.getStatus();

    assert.equal(renamed.label, 'Conta final');
    assert.equal(renamed.sourceFilePath, existingAccountFilePath);
    assert.equal(await readFile(existingAccountFilePath, 'utf8'), authJson('account-a', 'managed-copy'));
    assert.match(await readFile(existingMetadataFilePath, 'utf8'), /Conta final/u);
    assert.match(await readFile(sourcesEnvironmentFilePath, 'utf8'), /Conta final/u);
    assert.equal(status.accounts.find((account) => account.accountId === 'account-a')?.label, 'Conta final');
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

test('codex auth router refreshes one token quota from backup without activating it', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-refresh-one-'));
  const canonicalAuthFilePath = join(sandboxPath, 'auth.json');
  const stateFilePath = join(sandboxPath, 'runtime', 'codex-auth-router.state.json');
  const backupDirectoryPath = join(sandboxPath, 'backups');
  const managedAccountsDirectoryPath = join(sandboxPath, 'secondary');
  const sourcesEnvironmentFilePath = join(sandboxPath, 'codex-auth-sources.env');
  const accountAFilePath = join(managedAccountsDirectoryPath, 'account-a', 'auth.json');
  const accountBFilePath = join(managedAccountsDirectoryPath, 'account-b', 'auth.json');
  const fetchCounts = new Map();

  try {
    await mkdir(join(sandboxPath, 'runtime'), { recursive: true });
    await mkdir(join(managedAccountsDirectoryPath, 'account-a'), { recursive: true });
    await mkdir(join(managedAccountsDirectoryPath, 'account-b'), { recursive: true });
    await writeFile(canonicalAuthFilePath, authJson('canonical-account', 'canonical-live'), 'utf8');
    await writeFile(accountAFilePath, authJson('account-a', 'backup-a'), 'utf8');
    await writeFile(accountBFilePath, authJson('account-b', 'backup-b'), 'utf8');
    await writeFile(
      sourcesEnvironmentFilePath,
      'LUME_HUB_CODEX_AUTH_SOURCES="' +
        JSON.stringify([
          {
            accountId: 'account-a',
            label: 'Conta A',
            filePath: accountAFilePath,
            priority: 1,
            kind: 'secondary',
          },
          {
            accountId: 'account-b',
            label: 'Conta B',
            filePath: accountBFilePath,
            priority: 2,
            kind: 'secondary',
          },
        ])
          .replaceAll('\\', '\\\\')
          .replaceAll('"', '\\"') +
        '"\n',
      'utf8',
    );

    const repository = new CodexAccountRepository({
      canonicalAuthFilePath,
      stateFilePath,
      backupDirectoryPath,
      sourcesEnvironmentFilePath,
      managedAccountsDirectoryPath,
    });
    const writer = new CodexAuthCanonicalWriter({
      canonicalAuthFilePath,
      backupDirectoryPath,
    });
    const quotaService = new CodexAccountQuotaService({
      enabled: true,
      cacheTtlMs: 60_000,
      fetcher: async (_url, init) => {
        const authorization = init?.headers?.authorization ?? '';
        const count = (fetchCounts.get(authorization) ?? 0) + 1;
        fetchCounts.set(authorization, count);

        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              rate_limit: {
                allowed: true,
                limit_reached: false,
                primary_window: {
                  used_percent: authorization.includes('access-backup-a') && count === 2 ? 12 : 40,
                  reset_at: '2026-04-22T10:15:00.000Z',
                },
              },
            });
          },
        };
      },
    });
    const service = new CodexAuthRouterService(repository, writer, undefined, undefined, quotaService);

    const firstStatus = await service.getStatus();
    const refreshedStatus = await service.refreshAccountQuota('account-a');

    assert.equal(firstStatus.accounts.find((account) => account.accountId === 'account-a')?.quota?.primaryWindow?.remainingPercent, 60);
    assert.equal(refreshedStatus.accounts.find((account) => account.accountId === 'account-a')?.quota?.primaryWindow?.remainingPercent, 88);
    assert.equal(refreshedStatus.accounts.find((account) => account.accountId === 'account-b')?.quota?.primaryWindow?.remainingPercent, 60);
    assert.equal(fetchCounts.get('Bearer access-backup-a'), 2);
    assert.equal(fetchCounts.get('Bearer access-backup-b'), 1);
    assert.equal(await readFile(canonicalAuthFilePath, 'utf8'), authJson('canonical-account', 'canonical-live'));
    assert.equal(refreshedStatus.currentSelection, null);
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

test('codex auth router can remove a secondary token without touching the canonical auth', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-remove-'));
  const canonicalAuthFilePath = join(sandboxPath, 'auth.json');
  const stateFilePath = join(sandboxPath, 'runtime', 'codex-auth-router.state.json');
  const backupDirectoryPath = join(sandboxPath, 'backups');
  const managedAccountsDirectoryPath = join(sandboxPath, 'secondary');
  const sourcesEnvironmentFilePath = join(sandboxPath, 'codex-auth-sources.env');
  const existingAccountFilePath = join(managedAccountsDirectoryPath, 'account-a', 'auth.json');

  try {
    await mkdir(join(sandboxPath, 'runtime'), { recursive: true });
    await mkdir(join(managedAccountsDirectoryPath, 'account-a'), { recursive: true });
    await writeFile(canonicalAuthFilePath, authJson('canonical-account', 'canonical-live'), 'utf8');
    await writeFile(existingAccountFilePath, authJson('account-a', 'managed-copy'), 'utf8');
    await writeFile(
      sourcesEnvironmentFilePath,
      'LUME_HUB_CODEX_AUTH_SOURCES="' +
        JSON.stringify([
          {
            accountId: 'account-a',
            label: 'Conta A',
            filePath: existingAccountFilePath,
            priority: 1,
            kind: 'secondary',
          },
        ])
          .replaceAll('\\', '\\\\')
          .replaceAll('"', '\\"') +
        '"\n',
      'utf8',
    );

    const repository = new CodexAccountRepository({
      canonicalAuthFilePath,
      stateFilePath,
      backupDirectoryPath,
      sourcesEnvironmentFilePath,
      managedAccountsDirectoryPath,
    });
    const writer = new CodexAuthCanonicalWriter({
      canonicalAuthFilePath,
      backupDirectoryPath,
    });
    const service = new CodexAuthRouterService(repository, writer);

    const removed = await service.removeAccount('account-a');
    const status = await service.getStatus();

    assert.equal(removed.accountId, 'account-a');
    assert.equal(removed.label, 'Conta A');
    assert.equal(removed.removedStoredFile, true);
    await assert.rejects(readFile(existingAccountFilePath, 'utf8'), /ENOENT/u);
    assert.doesNotMatch(await readFile(sourcesEnvironmentFilePath, 'utf8'), /account-a/u);
    assert.equal(status.accounts.some((account) => account.accountId === 'account-a'), false);
    assert.equal(await readFile(canonicalAuthFilePath, 'utf8'), authJson('canonical-account', 'canonical-live'));
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

test('codex auth router refuses to remove the active token', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-remove-active-'));
  const canonicalAuthFilePath = join(sandboxPath, 'auth.json');
  const stateFilePath = join(sandboxPath, 'runtime', 'codex-auth-router.state.json');
  const backupDirectoryPath = join(sandboxPath, 'backups');
  const managedAccountsDirectoryPath = join(sandboxPath, 'secondary');
  const sourcesEnvironmentFilePath = join(sandboxPath, 'codex-auth-sources.env');
  const existingAccountFilePath = join(managedAccountsDirectoryPath, 'account-a', 'auth.json');

  try {
    await mkdir(join(sandboxPath, 'runtime'), { recursive: true });
    await mkdir(join(managedAccountsDirectoryPath, 'account-a'), { recursive: true });
    await writeFile(canonicalAuthFilePath, authJson('canonical-account', 'canonical-live'), 'utf8');
    await writeFile(existingAccountFilePath, authJson('account-a', 'managed-copy'), 'utf8');
    await writeFile(
      sourcesEnvironmentFilePath,
      'LUME_HUB_CODEX_AUTH_SOURCES="' +
        JSON.stringify([
          {
            accountId: 'account-a',
            label: 'Conta A',
            filePath: existingAccountFilePath,
            priority: 1,
            kind: 'secondary',
          },
        ])
          .replaceAll('\\', '\\\\')
          .replaceAll('"', '\\"') +
        '"\n',
      'utf8',
    );

    const repository = new CodexAccountRepository({
      canonicalAuthFilePath,
      stateFilePath,
      backupDirectoryPath,
      sourcesEnvironmentFilePath,
      managedAccountsDirectoryPath,
    });
    const writer = new CodexAuthCanonicalWriter({
      canonicalAuthFilePath,
      backupDirectoryPath,
    });
    const service = new CodexAuthRouterService(repository, writer);

    await service.forceSwitch('account-a', { reason: 'test-active-switch' });

    await assert.rejects(
      service.removeAccount('account-a'),
      /Troca primeiro para outro token antes de apagares esta conta do router\./u,
    );
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
