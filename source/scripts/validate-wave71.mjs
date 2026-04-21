import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { packageRelease } from './package-release.mjs';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SOURCE_ROOT, '..');
const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave71-'));

try {
  const runtimeRoot = resolve(sandboxPath, 'runtime');
  const result = await packageRelease({
    repoRoot: REPO_ROOT,
    sourceRoot: SOURCE_ROOT,
    runtimeRoot,
    releaseId: 'wave71-commercial-kit',
    generatedAt: new Date('2026-04-21T11:20:00.000Z'),
  });

  await access(result.backend.bundleFilePath, fsConstants.F_OK);
  await access(result.host.bundleFilePath, fsConstants.F_OK);
  await access(result.backend.entrypointPath, fsConstants.X_OK);
  await access(result.host.entrypointPath, fsConstants.X_OK);

  const backendManifest = JSON.parse(await readFile(result.backend.manifestPath, 'utf8'));
  assert.equal(backendManifest.delivery.packagingModel, 'backend_container_artifact');
  assert.equal(backendManifest.delivery.artifactKind, 'tarball_and_published_tree');
  assert.equal(backendManifest.delivery.containerImageIncluded, false);
  assert.equal(backendManifest.delivery.requiresHostCompanion, true);
  assert.match(backendManifest.delivery.honestLimit, /not sold as a single-container product/u);
  assert.equal(backendManifest.mounts.auth.runtimePath, '/codex/auth.json');
  assert.equal(backendManifest.mounts.auth.mode, 'read_only');
  assert.equal(backendManifest.mounts.data.runtimePath, '/srv/lume-hub/data');
  assert.equal(backendManifest.mounts.logs.runtimePath, '/srv/lume-hub/logs');

  const hostManifest = JSON.parse(await readFile(result.host.manifestPath, 'utf8'));
  assert.equal(hostManifest.delivery.packagingModel, 'host_companion_outside_container');
  assert.equal(hostManifest.delivery.required, true);
  assert.deepEqual(hostManifest.delivery.responsibilities, [
    'power_policy',
    'autostart',
    'codex_oauth_ownership',
    'host_heartbeat',
  ]);
  assert.equal(hostManifest.auth.hostPath, '/home/eliaspc/.codex/auth.json');

  const backendReadme = await readFile(resolve(result.backend.stagePath, 'README.md'), 'utf8');
  const hostReadme = await readFile(resolve(result.host.stagePath, 'README.md'), 'utf8');
  assert.match(backendReadme, /backend artifact for a container runtime/u);
  assert.match(hostReadme, /required outside the backend container/u);

  const deliveryKitDoc = await readFile(
    resolve(REPO_ROOT, 'docs', 'deployment', 'lume_hub_commercial_delivery_kit.md'),
    'utf8',
  );
  assert.match(deliveryKitDoc, /nao deve ser vendido como `um container unico`/u);
  assert.match(deliveryKitDoc, /## Install curto/u);
  assert.match(deliveryKitDoc, /## Update curto/u);
  assert.match(deliveryKitDoc, /## Health check curto/u);
  assert.match(deliveryKitDoc, /## Recovery de token\/auth/u);
  assert.match(deliveryKitDoc, /runtime\/lxd\/host-mounts\/data/u);
  assert.match(deliveryKitDoc, /runtime\/lxd\/host-mounts\/logs/u);
  assert.match(deliveryKitDoc, /\/home\/eliaspc\/\.codex\/auth\.json/u);

  const releaseGuide = await readFile(
    resolve(REPO_ROOT, 'docs', 'deployment', 'lume_hub_release_publish.md'),
    'utf8',
  );
  assert.match(releaseGuide, /lume_hub_commercial_delivery_kit\.md/u);
  assert.match(releaseGuide, /nao deve ser apresentado como produto de `um container unico`/u);

  console.log(`Wave 71 commercial delivery kit validation passed in ${sandboxPath}`);
} finally {
  await rm(sandboxPath, { recursive: true, force: true });
}
