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
