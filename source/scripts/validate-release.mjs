import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { packageRelease } from './package-release.mjs';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SOURCE_ROOT, '..');

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-release-'));

try {
  const runtimeRoot = resolve(sandboxPath, 'runtime');
  const result = await packageRelease({
    repoRoot: REPO_ROOT,
    sourceRoot: SOURCE_ROOT,
    runtimeRoot,
    releaseId: 'validation',
    generatedAt: new Date('2026-03-26T23:20:00.000Z'),
  });

  await access(result.backend.bundleFilePath, fsConstants.F_OK);
  await access(result.host.bundleFilePath, fsConstants.F_OK);
  await access(result.backend.entrypointPath, fsConstants.X_OK);
  await access(result.host.entrypointPath, fsConstants.X_OK);
  await access(result.host.servicePath, fsConstants.F_OK);

  const backendManifest = JSON.parse(await readFile(result.backend.manifestPath, 'utf8'));
  assert.equal(backendManifest.mounts.auth.runtimePath, '/codex/auth.json');
  assert.equal(backendManifest.mounts.data.runtimePath, '/srv/lume-hub/data');
  assert.equal(backendManifest.mounts.logs.runtimePath, '/srv/lume-hub/logs');

  const hostManifest = JSON.parse(await readFile(result.host.manifestPath, 'utf8'));
  assert.equal(hostManifest.paths.state, 'runtime/host/state');
  assert.equal(hostManifest.paths.backendBridgeState, 'runtime/lxd/host-mounts/data/runtime/host-state.json');

  const authFilePath = resolve(sandboxPath, 'auth', 'auth.json');
  await mkdir(dirname(authFilePath), { recursive: true });
  await writeFile(authFilePath, '{"account":"validation","token":"release"}\n', 'utf8');

  const backendProcess = spawn(result.backend.entrypointPath, {
    cwd: result.backend.stagePath,
    stdio: 'ignore',
    env: {
      ...process.env,
      LUME_HUB_HTTP_PORT: '18431',
      LUME_HUB_HTTP_HOST: '127.0.0.1',
      CODEX_AUTH_FILE: authFilePath,
      LUME_HUB_CODEX_AUTH_FILE: authFilePath,
      LUME_HUB_DATA_DIR: resolve(runtimeRoot, 'lxd', 'host-mounts', 'data'),
      LUME_HUB_CONFIG_DIR: resolve(runtimeRoot, 'lxd', 'host-mounts', 'data', 'config'),
      LUME_HUB_RUNTIME_DIR: resolve(runtimeRoot, 'lxd', 'host-mounts', 'data', 'runtime'),
      LUME_HUB_WEB_DIST_ROOT: resolve(result.backend.stagePath, 'apps', 'lume-hub-web', 'dist'),
    },
  });
  await waitForHttp('http://127.0.0.1:18431/api/runtime/diagnostics');
  const todayResponse = await fetch('http://127.0.0.1:18431/today');
  assert.equal(todayResponse.status, 200);
  const todayHtml = await todayResponse.text();
  assert.match(todayHtml, /LumeHub/u);
  assert.equal(backendProcess.exitCode, null);
  backendProcess.kill('SIGTERM');
  assert.equal(await waitForExitCode(backendProcess, { allowSignals: ['SIGTERM'] }), 0);

  const hostProcess = spawn(result.host.entrypointPath, {
    cwd: result.host.stagePath,
    stdio: 'ignore',
    env: {
      ...process.env,
      CODEX_AUTH_FILE: authFilePath,
    },
  });

  const hostStateFilePath = resolve(runtimeRoot, 'host', 'state', 'host-runtime-state.json');
  const backendStateFilePath = resolve(runtimeRoot, 'lxd', 'host-mounts', 'data', 'runtime', 'host-state.json');
  await waitForFile(hostStateFilePath);
  await waitForFile(backendStateFilePath);

  hostProcess.kill('SIGTERM');
  assert.equal(await waitForExitCode(hostProcess, { allowSignals: ['SIGTERM'] }), 0);

  const serviceContents = await readFile(result.host.servicePath, 'utf8');
  assert.equal(serviceContents.includes(result.host.entrypointPath), true);

  console.log(`Release validation passed in ${sandboxPath}`);
} finally {
  await rm(sandboxPath, { recursive: true, force: true });
}

async function waitForFile(filePath, timeoutMs = 5_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      await access(filePath, fsConstants.F_OK);
      return;
    } catch {
      await delay(100);
    }
  }

  throw new Error(`Timed out while waiting for file '${filePath}'.`);
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

async function waitForHttp(url, timeoutMs = 10_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {}

    await delay(150);
  }

  throw new Error(`Timed out while waiting for '${url}'.`);
}

function waitForExitCode(childProcess, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    childProcess.once('error', rejectPromise);
    childProcess.once('exit', (code, signal) => {
      if (signal) {
        if (options.allowSignals?.includes(signal)) {
          resolvePromise(0);
          return;
        }

        rejectPromise(new Error(`Process exited due to signal '${signal}'.`));
        return;
      }

      resolvePromise(code ?? 0);
    });
  });
}
