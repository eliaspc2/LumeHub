import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { packageWave12 } from './package-wave12.mjs';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SOURCE_ROOT, '..');

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave12-'));

try {
  const runtimeRoot = resolve(sandboxPath, 'runtime');
  const result = await packageWave12({
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

  const backendProcess = spawn(result.backend.entrypointPath, {
    cwd: result.backend.stagePath,
    stdio: 'ignore',
  });
  await delay(500);
  assert.equal(backendProcess.exitCode, null);
  backendProcess.kill('SIGTERM');
  assert.equal(await waitForExitCode(backendProcess), 0);

  const authFilePath = resolve(sandboxPath, 'auth', 'auth.json');
  await mkdir(dirname(authFilePath), { recursive: true });
  await writeFile(authFilePath, '{"account":"validation","token":"wave12"}\n', 'utf8');

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
  assert.equal(await waitForExitCode(hostProcess), 0);

  const serviceContents = await readFile(result.host.servicePath, 'utf8');
  assert.equal(serviceContents.includes(result.host.entrypointPath), true);

  console.log(`Wave 12 validation passed in ${sandboxPath}`);
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

function waitForExitCode(childProcess) {
  return new Promise((resolvePromise, rejectPromise) => {
    childProcess.once('error', rejectPromise);
    childProcess.once('exit', (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`Process exited due to signal '${signal}'.`));
        return;
      }

      resolvePromise(code ?? 0);
    });
  });
}
