import test from 'node:test';
import assert from 'node:assert/strict';

const { resolveBackendRuntimePaths } = await import(
  '../../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/BackendRuntimeConfig.js'
);

test('backend runtime paths honour portable env overrides', () => {
  const previousEnv = {
    LUME_HUB_DATA_DIR: process.env.LUME_HUB_DATA_DIR,
    LUME_HUB_CONFIG_DIR: process.env.LUME_HUB_CONFIG_DIR,
    LUME_HUB_RUNTIME_DIR: process.env.LUME_HUB_RUNTIME_DIR,
    CODEX_AUTH_FILE: process.env.CODEX_AUTH_FILE,
    LUME_HUB_CANONICAL_CODEX_AUTH_FILE: process.env.LUME_HUB_CANONICAL_CODEX_AUTH_FILE,
    LUME_HUB_WEB_DIST_ROOT: process.env.LUME_HUB_WEB_DIST_ROOT,
    LUME_HUB_HOST_EXEC_START: process.env.LUME_HUB_HOST_EXEC_START,
  };

  process.env.LUME_HUB_DATA_DIR = '/portable/data';
  process.env.LUME_HUB_CONFIG_DIR = '/portable/data/config-explicit';
  process.env.LUME_HUB_RUNTIME_DIR = '/portable/data/runtime-explicit';
  process.env.CODEX_AUTH_FILE = '/portable/auth/auth.json';
  process.env.LUME_HUB_CANONICAL_CODEX_AUTH_FILE = '/portable/auth/canonical.json';
  process.env.LUME_HUB_WEB_DIST_ROOT = '/portable/web-dist';
  process.env.LUME_HUB_HOST_EXEC_START = '/portable/bin/lume-hub-host';

  try {
    const paths = resolveBackendRuntimePaths({
      rootPath: '/portable/project',
    });

    assert.equal(paths.dataRootPath, '/portable/data');
    assert.equal(paths.configRootPath, '/portable/data/config-explicit');
    assert.equal(paths.runtimeRootPath, '/portable/data/runtime-explicit');
    assert.equal(paths.codexAuthFile, '/portable/auth/auth.json');
    assert.equal(paths.canonicalCodexAuthFile, '/portable/auth/canonical.json');
    assert.equal(paths.webDistRootPath, '/portable/web-dist');
    assert.equal(paths.hostExecStart, '/portable/bin/lume-hub-host');
  } finally {
    restoreEnv(previousEnv);
  }
});

function restoreEnv(previousEnv) {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}
