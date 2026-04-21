import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SOURCE_ROOT, '..');

await validateDocsAndScripts();
await validateCodexAuthSourcesEnv();

console.log('Wave 73 operational cutover validation passed');

async function validateDocsAndScripts() {
  const packageJson = JSON.parse(await readFile(resolve(SOURCE_ROOT, 'package.json'), 'utf8'));
  assert.match(packageJson.scripts['validate:wave73'], /validate-wave73\.mjs/u);

  const implementationWaves = await readFile(
    resolve(REPO_ROOT, 'docs', 'architecture', 'lume_hub_implementation_waves.md'),
    'utf8',
  );
  assert.match(implementationWaves, /Nao existem waves ativas neste momento/u);
  assert.match(implementationWaves, /`validate:wave73`/u);
  assert.match(implementationWaves, /Wave 73/u);

  const packageRelease = await readFile(resolve(SOURCE_ROOT, 'scripts', 'package-release.mjs'), 'utf8');
  assert.match(packageRelease, /EnvironmentFile=-\/home\/eliaspc\/Documentos\/lume-hub\/runtime\/host\/codex-auth-sources\.env/u);
  assert.match(packageRelease, /const backendRuntimeRoot = resolve\(lxdRoot, 'host-mounts', 'data', 'runtime'\)/u);
  assert.match(packageRelease, /LUME_HUB_CODEX_AUTH_ROUTER_BACKUP_HISTORY/u);
  assert.match(packageRelease, /codex-auth-router-backups', 'history'/u);
}

async function validateCodexAuthSourcesEnv() {
  const { resolveCodexAuthSources } = await import(
    '../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/BackendRuntimeConfig.js'
  );
  const { HostModuleLoader } = await import(
    '../apps/lume-hub-host/dist/apps/lume-hub-host/src/bootstrap/HostModuleLoader.js'
  );
  const sandboxRoot = await mkdtemp(resolve(tmpdir(), 'lume-hub-wave73-'));
  const previousSources = process.env.LUME_HUB_CODEX_AUTH_SOURCES;

  try {
    const canonicalAuthFile = resolve(sandboxRoot, 'canonical-auth.json');
    const accountAFile = resolve(sandboxRoot, 'account-a-auth.json');
    const accountBFile = resolve(sandboxRoot, 'account-b-auth.json');
    await writeFile(canonicalAuthFile, '{"account":"canonical"}\n', 'utf8');
    await writeFile(accountAFile, '{"account":"a"}\n', 'utf8');
    await writeFile(accountBFile, '{"account":"b"}\n', 'utf8');

    process.env.LUME_HUB_CODEX_AUTH_SOURCES = JSON.stringify([
      {
        accountId: 'account-a',
        label: 'Account A',
        filePath: accountAFile,
        priority: 1,
      },
      {
        accountId: 'account-b',
        label: 'Account B',
        filePath: accountBFile,
        priority: 2,
      },
    ]);

    const parsedSources = resolveCodexAuthSources();
    assert.equal(parsedSources?.length, 2);
    assert.equal(parsedSources?.[0]?.accountId, 'account-a');

    const loaded = new HostModuleLoader({
      rootPath: sandboxRoot,
      codexAuthFile: canonicalAuthFile,
      canonicalCodexAuthFile: canonicalAuthFile,
      codexAuthRouterStateFilePath: resolve(sandboxRoot, 'router-state.json'),
      codexAuthRouterBackupDirectoryPath: resolve(sandboxRoot, 'router-backups'),
      codexAuthRouterBackupHistoryDirectoryPath: resolve(sandboxRoot, 'router-backups', 'history'),
    }).load();
    const status = await loaded.codexAuthRouterModule.getStatus();
    assert.equal(status.accountCount, 3);
    assert.deepEqual(
      status.accounts.map((account) => account.accountId),
      ['canonical-live', 'account-a', 'account-b'],
    );
    assert.equal(status.accounts.every((account) => account.exists), true);
  } finally {
    if (previousSources === undefined) {
      delete process.env.LUME_HUB_CODEX_AUTH_SOURCES;
    } else {
      process.env.LUME_HUB_CODEX_AUTH_SOURCES = previousSources;
    }
    await rm(sandboxRoot, { recursive: true, force: true });
  }
}
