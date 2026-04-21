import { access, chmod, cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SOURCE_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const DEFAULT_REPO_ROOT = resolve(SOURCE_ROOT, '..');

export async function packageRelease(options = {}) {
  const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
  const sourceRoot = options.sourceRoot ?? resolve(repoRoot, 'source');
  const runtimeRoot = options.runtimeRoot ?? resolve(repoRoot, 'runtime');
  const generatedAt = options.generatedAt ?? new Date();
  const releaseId = options.releaseId ?? (await resolveReleaseId(repoRoot));
  const lxdRoot = resolve(runtimeRoot, 'lxd');
  const hostRoot = resolve(runtimeRoot, 'host');

  const backendStagePath = resolve(lxdRoot, 'host-mounts', 'app-release', 'current');
  const backendBundlesPath = resolve(lxdRoot, 'release-bundles');
  const backendBundleFilePath = resolve(backendBundlesPath, `lume-hub-backend-${releaseId}.tar.gz`);

  const hostStagePath = resolve(hostRoot, 'current');
  const hostBundlesPath = resolve(hostRoot, 'releases');
  const hostBundleFilePath = resolve(hostBundlesPath, `lume-hub-host-${releaseId}.tar.gz`);
  const hostSystemdUserPath = resolve(hostRoot, 'systemd-user');

  await ensureRuntimeLayout(lxdRoot, hostRoot, hostSystemdUserPath);

  const backendMetadata = await publishBackendRelease({
    sourceRoot,
    stagePath: backendStagePath,
    bundleFilePath: backendBundleFilePath,
    releaseId,
    generatedAt,
  });
  const hostMetadata = await publishHostRelease({
    sourceRoot,
    stagePath: hostStagePath,
    bundleFilePath: hostBundleFilePath,
    hostRoot,
    lxdRoot,
    systemdUserPath: hostSystemdUserPath,
    releaseId,
    generatedAt,
  });

  return {
    releaseId,
    generatedAt: generatedAt.toISOString(),
    backend: backendMetadata,
    host: hostMetadata,
  };
}

async function ensureRuntimeLayout(lxdRoot, hostRoot, hostSystemdUserPath) {
  await mkdir(resolve(lxdRoot, 'release-bundles'), { recursive: true });
  await mkdir(resolve(lxdRoot, 'host-mounts', 'app-release'), { recursive: true });
  await mkdir(resolve(lxdRoot, 'host-mounts', 'data', 'groups'), { recursive: true });
  await mkdir(resolve(lxdRoot, 'host-mounts', 'data', 'runtime'), { recursive: true });
  await mkdir(resolve(lxdRoot, 'host-mounts', 'logs'), { recursive: true });

  await mkdir(resolve(hostRoot, 'state'), { recursive: true });
  await mkdir(resolve(hostRoot, 'releases'), { recursive: true });
  await mkdir(hostSystemdUserPath, { recursive: true });
}

async function publishBackendRelease({ sourceRoot, stagePath, bundleFilePath, releaseId, generatedAt }) {
  await resetDirectory(stagePath);
  await cp(resolve(sourceRoot, 'apps', 'lume-hub-backend', 'dist'), resolve(stagePath, 'dist'), {
    recursive: true,
  });
  await populateRuntimeNodeModules(stagePath, sourceRoot);

  await writeJson(resolve(stagePath, 'package.json'), {
    name: '@lume-hub/backend-release',
    private: true,
    type: 'module',
  });

  const manifest = {
    schemaVersion: 1,
    artifact: 'lume-hub-backend',
    releaseId,
    generatedAt: generatedAt.toISOString(),
    entrypoint: {
      hostPath: 'current/bin/lume-hub-backend',
      containerPath: '/srv/lume-hub/app/current/bin/lume-hub-backend',
    },
    mounts: {
      auth: {
        hostPath: '/home/eliaspc/.codex/auth.json',
        runtimePath: '/codex/auth.json',
        mode: 'read_only',
      },
      data: {
        hostPath: 'runtime/lxd/host-mounts/data',
        runtimePath: '/srv/lume-hub/data',
        mode: 'read_write',
      },
      logs: {
        hostPath: 'runtime/lxd/host-mounts/logs',
        runtimePath: '/srv/lume-hub/logs',
        mode: 'read_write',
      },
      app: {
        hostPath: 'runtime/lxd/host-mounts/app-release',
        runtimePath: '/srv/lume-hub/app',
        mode: 'read_write',
      },
    },
    delivery: {
      packagingModel: 'backend_container_artifact',
      artifactKind: 'tarball_and_published_tree',
      containerImageIncluded: false,
      requiresHostCompanion: true,
      honestLimit:
        'This is not sold as a single-container product while energy, autostart and Codex OAuth ownership require the host companion outside the container.',
    },
  };
  await writeJson(resolve(stagePath, 'release-manifest.json'), manifest);

  const backendBinPath = resolve(stagePath, 'bin', 'lume-hub-backend');
  await writeExecutableFile(
    backendBinPath,
    `#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
export CODEX_AUTH_FILE="\${CODEX_AUTH_FILE:-/codex/auth.json}"
export LUME_HUB_DATA_DIR="\${LUME_HUB_DATA_DIR:-/srv/lume-hub/data}"
export LUME_HUB_LOG_DIR="\${LUME_HUB_LOG_DIR:-/srv/lume-hub/logs}"
if [[ -x /opt/node-v20-current/bin/node ]]; then
  NODE_BIN="/opt/node-v20-current/bin/node"
else
  NODE_BIN="$(command -v node)"
fi
exec "$NODE_BIN" "$APP_ROOT/dist/apps/lume-hub-backend/src/main.js"
`,
  );

  await mkdir(resolve(stagePath, 'systemd'), { recursive: true });
  await writeFile(
    resolve(stagePath, 'systemd', 'lume-hub-backend.service'),
    [
      '[Unit]',
      'Description=Lume Hub Backend',
      'After=network-online.target',
      'Wants=network-online.target',
      '',
      '[Service]',
      'Type=simple',
      'WorkingDirectory=/srv/lume-hub/app/current',
      'Environment=CODEX_AUTH_FILE=/codex/auth.json',
      'Environment=LUME_HUB_DATA_DIR=/srv/lume-hub/data',
      'Environment=LUME_HUB_LOG_DIR=/srv/lume-hub/logs',
      'ExecStart=/srv/lume-hub/app/current/bin/lume-hub-backend',
      'Restart=always',
      'RestartSec=5',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      '',
    ].join('\n'),
    'utf8',
  );

  await writeFile(
    resolve(stagePath, 'README.md'),
    [
      '# Published Backend Release',
      '',
      '- entrypoint: `bin/lume-hub-backend`',
      '- service unit reference: `systemd/lume-hub-backend.service`',
      '- data mount: `/srv/lume-hub/data`',
      '- logs mount: `/srv/lume-hub/logs`',
      '- auth mount: `/codex/auth.json`',
      '- delivery note: backend artifact for a container runtime; not a complete single-container product without the host companion',
      '',
    ].join('\n'),
    'utf8',
  );

  await createTarballFromStage(stagePath, bundleFilePath, `lume-hub-backend-${releaseId}`);

  return {
    bundleFilePath,
    stagePath,
    manifestPath: resolve(stagePath, 'release-manifest.json'),
    servicePath: resolve(stagePath, 'systemd', 'lume-hub-backend.service'),
    entrypointPath: backendBinPath,
  };
}

async function publishHostRelease({
  sourceRoot,
  stagePath,
  bundleFilePath,
  hostRoot,
  lxdRoot,
  systemdUserPath,
  releaseId,
  generatedAt,
}) {
  await resetDirectory(stagePath);
  await cp(resolve(sourceRoot, 'apps', 'lume-hub-host', 'dist'), resolve(stagePath, 'dist'), {
    recursive: true,
  });
  await populateRuntimeNodeModules(stagePath, sourceRoot);

  await writeJson(resolve(stagePath, 'package.json'), {
    name: '@lume-hub/host-release',
    private: true,
    type: 'module',
  });

  const hostRunnerModulePath = resolve(stagePath, 'bin', 'lume-hub-host.mjs');
  await mkdir(resolve(stagePath, 'bin'), { recursive: true });
  await writeFile(
    hostRunnerModulePath,
    `import { HostBootstrap } from '../dist/apps/lume-hub-host/src/bootstrap/HostBootstrap.js';
import { HostModuleLoader } from '../dist/apps/lume-hub-host/src/bootstrap/HostModuleLoader.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const binDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(binDir, '..');
const hostRoot = resolve(appRoot, '..');
const lxdRoot = resolve(hostRoot, '..', 'lxd');
const codexAuthFile = process.env.CODEX_AUTH_FILE ?? '/home/eliaspc/.codex/auth.json';
const bootstrap = new HostBootstrap(
  new HostModuleLoader({
    codexAuthFile,
    canonicalCodexAuthFile: codexAuthFile,
    hostStateFilePath: resolve(hostRoot, 'state', 'host-runtime-state.json'),
    powerStateFilePath: resolve(hostRoot, 'state', 'power-policy-state.json'),
    inhibitorStatePath: resolve(hostRoot, 'state', 'sleep-inhibitor.json'),
    systemdUserPath: resolve(hostRoot, 'systemd-user'),
    backendStateFilePath: process.env.LUME_HUB_BACKEND_STATE_FILE ?? resolve(lxdRoot, 'host-mounts', 'data', 'runtime', 'host-state.json'),
    workingDirectory: appRoot,
    execStart: \`/usr/bin/env node \${resolve(appRoot, 'bin', 'lume-hub-host.mjs')}\`,
  }),
);

const HEARTBEAT_INTERVAL_MS = 60_000;
let heartbeatTimer;
let shuttingDown = false;

const shutdown = async () => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  }

  try {
    await bootstrap.stop();
  } finally {
    process.exit(0);
  }
};

process.once('SIGINT', () => {
  void shutdown();
});
process.once('SIGTERM', () => {
  void shutdown();
});

try {
  await bootstrap.start();

  heartbeatTimer = setInterval(() => {
    void bootstrap.heartbeat().catch((error) => {
      console.error('Failed to publish host heartbeat.', error);
    });
  }, HEARTBEAT_INTERVAL_MS);
} catch (error) {
  console.error('Failed to start published lume-hub-host release.', error);
  process.exitCode = 1;
}
`,
    'utf8',
  );

  const hostBinPath = resolve(stagePath, 'bin', 'lume-hub-host');
  await writeExecutableFile(
    hostBinPath,
    `#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
if [[ -x /opt/node-v20-current/bin/node ]]; then
  NODE_BIN="/opt/node-v20-current/bin/node"
else
  NODE_BIN="$(command -v node)"
fi
exec "$NODE_BIN" "$SCRIPT_DIR/lume-hub-host.mjs"
`,
  );

  const manifest = {
    schemaVersion: 1,
    artifact: 'lume-hub-host',
    releaseId,
    generatedAt: generatedAt.toISOString(),
    entrypoint: {
      hostPath: 'runtime/host/current/bin/lume-hub-host',
    },
    paths: {
      state: 'runtime/host/state',
      systemdUser: 'runtime/host/systemd-user',
      backendBridgeState: 'runtime/lxd/host-mounts/data/runtime/host-state.json',
    },
    auth: {
      hostPath: '/home/eliaspc/.codex/auth.json',
      envKey: 'CODEX_AUTH_FILE',
    },
    delivery: {
      packagingModel: 'host_companion_outside_container',
      required: true,
      responsibilities: ['power_policy', 'autostart', 'codex_oauth_ownership', 'host_heartbeat'],
      honestLimit: 'This component must be delivered and supervised on the host alongside the backend container artifact.',
    },
  };
  await writeJson(resolve(stagePath, 'release-manifest.json'), manifest);

  const servicePath = resolve(systemdUserPath, 'lume-hub-host.service');
  const serviceContent = [
    '[Unit]',
    'Description=Lume Hub Host Companion',
    'After=network-online.target',
    'Wants=network-online.target',
    '',
    '[Service]',
    'Type=simple',
    `WorkingDirectory=${stagePath}`,
    'Environment=CODEX_AUTH_FILE=/home/eliaspc/.codex/auth.json',
    `ExecStart=${hostBinPath}`,
    'Restart=always',
    'RestartSec=5',
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n');
  await writeFile(servicePath, serviceContent, 'utf8');
  await mkdir(resolve(stagePath, 'systemd'), { recursive: true });
  await writeFile(resolve(stagePath, 'systemd', 'lume-hub-host.service'), serviceContent, 'utf8');

  await writeFile(
    resolve(stagePath, 'README.md'),
    [
      '# Published Host Release',
      '',
      '- entrypoint: `bin/lume-hub-host`',
      '- state path: `../state/`',
      '- systemd unit: `../systemd-user/lume-hub-host.service`',
      '- backend bridge state: `../../lxd/host-mounts/data/runtime/host-state.json`',
      '- delivery note: required outside the backend container for power, autostart and Codex OAuth ownership',
      '',
    ].join('\n'),
    'utf8',
  );

  await createTarballFromStage(stagePath, bundleFilePath, `lume-hub-host-${releaseId}`);

  return {
    bundleFilePath,
    stagePath,
    manifestPath: resolve(stagePath, 'release-manifest.json'),
    servicePath,
    entrypointPath: hostBinPath,
  };
}

async function createTarballFromStage(stagePath, bundleFilePath, bundleRootName) {
  await mkdir(dirname(bundleFilePath), { recursive: true });
  await rm(bundleFilePath, { force: true });

  const temporaryRoot = await mkdtemp(join(tmpdir(), 'lume-hub-release-bundle-'));
  const bundleRootPath = resolve(temporaryRoot, bundleRootName);

  try {
    await cp(stagePath, bundleRootPath, { recursive: true });
    await execFileAsync('tar', ['-czf', bundleFilePath, '-C', temporaryRoot, bundleRootName]);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function populateRuntimeNodeModules(stagePath, sourceRoot) {
  const destinationNodeModulesPath = resolve(stagePath, 'node_modules');
  await rm(destinationNodeModulesPath, { recursive: true, force: true });
  await mkdir(destinationNodeModulesPath, { recursive: true });

  const workspacePackageJsonPaths = await listWorkspacePackageJsonPaths(sourceRoot);

  for (const packageJsonPath of workspacePackageJsonPaths) {
    const manifest = JSON.parse(await readFile(packageJsonPath, 'utf8'));

    if (typeof manifest.name !== 'string' || !manifest.name.startsWith('@lume-hub/')) {
      continue;
    }

    const sourcePackageRoot = dirname(packageJsonPath);
    const destinationPackageRoot = resolve(destinationNodeModulesPath, ...manifest.name.split('/'));

    await mkdir(dirname(destinationPackageRoot), { recursive: true });
    await rm(destinationPackageRoot, { recursive: true, force: true });
    await mkdir(destinationPackageRoot, { recursive: true });

    await cp(packageJsonPath, resolve(destinationPackageRoot, 'package.json'));

    const sourceDistPath = resolve(sourcePackageRoot, 'dist');
    await cp(sourceDistPath, resolve(destinationPackageRoot, 'dist'), { recursive: true });
  }

  const externalDependencies = new Set();

  for (const packageJsonPath of workspacePackageJsonPaths) {
    const manifest = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    const dependencyEntries = Object.entries({
      ...(manifest.dependencies ?? {}),
      ...(manifest.optionalDependencies ?? {}),
    });

    for (const [dependencyName] of dependencyEntries) {
      if (!dependencyName.startsWith('@lume-hub/')) {
        externalDependencies.add(dependencyName);
      }
    }
  }

  const workspaceRequire = createRequire(resolve(sourceRoot, 'scripts', 'package-release.mjs'));
  const visitedDependencies = new Set();

  for (const dependencyName of externalDependencies) {
    await copyExternalDependencyTree(dependencyName, sourceRoot, workspaceRequire, destinationNodeModulesPath, visitedDependencies);
  }
}

async function copyExternalDependencyTree(packageName, sourceRoot, workspaceRequire, destinationNodeModulesPath, visitedDependencies) {
  if (visitedDependencies.has(packageName)) {
    return;
  }

  visitedDependencies.add(packageName);

  const sourcePackagePath = await resolveExternalPackagePath(packageName, sourceRoot, workspaceRequire);
  const destinationPackagePath = resolve(destinationNodeModulesPath, ...packageName.split('/'));
  await mkdir(dirname(destinationPackagePath), { recursive: true });
  await rm(destinationPackagePath, { recursive: true, force: true });
  await cp(sourcePackagePath, destinationPackagePath, { recursive: true });

  const manifest = JSON.parse(await readFile(resolve(destinationPackagePath, 'package.json'), 'utf8'));
  const dependencyEntries = Object.entries({
    ...(manifest.dependencies ?? {}),
    ...(manifest.optionalDependencies ?? {}),
  });

  for (const [dependencyName] of dependencyEntries) {
    if (dependencyName.startsWith('@lume-hub/')) {
      continue;
    }

    await copyExternalDependencyTree(dependencyName, sourceRoot, workspaceRequire, destinationNodeModulesPath, visitedDependencies);
  }
}

async function resolveExternalPackagePath(packageName, sourceRoot, workspaceRequire) {
  try {
    return realpath(dirname(workspaceRequire.resolve(`${packageName}/package.json`)));
  } catch {
    const pnpmRootPath = resolve(sourceRoot, 'node_modules', '.pnpm');
    const pnpmEntries = await readdir(pnpmRootPath);

    for (const entry of pnpmEntries) {
      const packageJsonPath = resolve(pnpmRootPath, entry, 'node_modules', ...packageName.split('/'), 'package.json');

      try {
        await access(packageJsonPath);
        return realpath(dirname(packageJsonPath));
      } catch {
        // Continue searching.
      }
    }

    throw new Error(`Unable to resolve external dependency '${packageName}' from '${sourceRoot}'.`);
  }
}

async function listWorkspacePackageJsonPaths(sourceRoot) {
  const packageJsonPaths = [];

  for (const workspaceRoot of [resolve(sourceRoot, 'packages'), resolve(sourceRoot, 'apps')]) {
    await walkForPackageJsons(workspaceRoot, packageJsonPaths);
  }

  return packageJsonPaths.sort((left, right) => left.localeCompare(right));
}

async function walkForPackageJsons(directoryPath, packageJsonPaths) {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = resolve(directoryPath, entry.name);

    if (entry.isDirectory()) {
      const packageJsonPath = resolve(entryPath, 'package.json');

      try {
        await access(packageJsonPath);
        packageJsonPaths.push(packageJsonPath);
        continue;
      } catch {
        await walkForPackageJsons(entryPath, packageJsonPaths);
      }
    }
  }
}

async function writeExecutableFile(filePath, contents) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, 'utf8');
  await chmod(filePath, 0o755);
}

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function resetDirectory(directoryPath) {
  await rm(directoryPath, { recursive: true, force: true });
  await mkdir(directoryPath, { recursive: true });
}

async function resolveReleaseId(repoRoot) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', repoRoot, 'rev-parse', '--short', 'HEAD']);
    const releaseId = stdout.trim();

    return releaseId.length > 0 ? releaseId : 'dev';
  } catch {
    return 'dev';
  }
}

async function main() {
  const result = await packageRelease();
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  await main();
}
