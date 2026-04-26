import { readdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPTS_ROOT = dirname(SCRIPT_PATH);
const SOURCE_ROOT = resolve(SCRIPTS_ROOT, '..');
const REPO_ROOT = resolve(SOURCE_ROOT, '..');
const RUNTIME_ROOT = resolve(REPO_ROOT, 'runtime');

const apply = process.argv.includes('--apply');

const hostReleaseDir = resolve(RUNTIME_ROOT, 'host', 'releases');
const backendReleaseDir = resolve(RUNTIME_ROOT, 'lxd', 'release-bundles');
const portableBundlesDir = resolve(RUNTIME_ROOT, 'portable-bundles');

const hostCurrentManifestPath = resolve(RUNTIME_ROOT, 'host', 'current', 'release-manifest.json');
const backendCurrentManifestPath = resolve(
  RUNTIME_ROOT,
  'lxd',
  'host-mounts',
  'app-release',
  'current',
  'release-manifest.json',
);

const hostCurrentReleaseIds = new Set(filterTruthy([await readReleaseId(hostCurrentManifestPath)]));
const backendCurrentReleaseIds = new Set(filterTruthy([await readReleaseId(backendCurrentManifestPath)]));

const hostArchives = await collectReleaseArchives(hostReleaseDir, 'lume-hub-host-');
const backendArchives = await collectReleaseArchives(backendReleaseDir, 'lume-hub-backend-');
const portableEntries = await collectPortableEntries(portableBundlesDir);

if (hostCurrentReleaseIds.size === 0) {
  const fallback = newestReleaseId(hostArchives);
  if (fallback) {
    hostCurrentReleaseIds.add(fallback);
  }
}

if (backendCurrentReleaseIds.size === 0) {
  const fallback = newestReleaseId(backendArchives);
  if (fallback) {
    backendCurrentReleaseIds.add(fallback);
  }
}

const portableReleaseIdToKeep = newestPortableReleaseId(portableEntries);

const staleHostArchives = hostArchives.filter((entry) => !hostCurrentReleaseIds.has(entry.releaseId));
const staleBackendArchives = backendArchives.filter((entry) => !backendCurrentReleaseIds.has(entry.releaseId));
const stalePortableEntries = portableEntries.filter((entry) => entry.releaseId !== portableReleaseIdToKeep);

const staleEntries = [...staleHostArchives, ...staleBackendArchives, ...stalePortableEntries];
const totalBytes = staleEntries.reduce((sum, entry) => sum + entry.bytes, 0);

console.log(`Runtime housekeeping (${apply ? 'apply' : 'dry-run'})`);
console.log(`- repo: ${REPO_ROOT}`);
console.log(`- keep host release ids: ${formatSet(hostCurrentReleaseIds)}`);
console.log(`- keep backend release ids: ${formatSet(backendCurrentReleaseIds)}`);
console.log(`- keep portable release id: ${portableReleaseIdToKeep ?? '(nenhum)'}`);
console.log(`- stale paths found: ${staleEntries.length}`);
console.log(`- reclaimable size: ${formatBytes(totalBytes)}`);

for (const entry of staleEntries) {
  console.log(`  ${apply ? 'delete' : 'would delete'} ${formatRelative(entry.path)} (${formatBytes(entry.bytes)})`);
}

if (!apply) {
  console.log('');
  console.log('Run again with --apply to remove the stale runtime artifacts.');
  process.exit(0);
}

for (const entry of staleEntries) {
  await rm(entry.path, { recursive: true, force: true });
}

console.log('');
console.log(`Removed ${staleEntries.length} stale paths and reclaimed about ${formatBytes(totalBytes)}.`);

async function readReleaseId(manifestPath) {
  try {
    const raw = await readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed.releaseId === 'string' && parsed.releaseId.trim() ? parsed.releaseId.trim() : null;
  } catch {
    return null;
  }
}

async function collectReleaseArchives(directoryPath, prefix) {
  const directoryEntries = await safeReadDirectory(directoryPath);
  const output = [];

  for (const entry of directoryEntries) {
    if (!entry.isFile()) {
      continue;
    }

    const releaseId = parseArchiveReleaseId(entry.name, prefix);

    if (!releaseId) {
      continue;
    }

    const absolutePath = resolve(directoryPath, entry.name);
    const metadata = await stat(absolutePath);
    output.push({
      path: absolutePath,
      releaseId,
      bytes: metadata.size,
      mtimeMs: metadata.mtimeMs,
    });
  }

  return output.sort((left, right) => left.path.localeCompare(right.path));
}

async function collectPortableEntries(directoryPath) {
  const directoryEntries = await safeReadDirectory(directoryPath);
  const output = [];

  for (const entry of directoryEntries) {
    const releaseId = parsePortableReleaseId(entry.name);

    if (!releaseId) {
      continue;
    }

    const absolutePath = resolve(directoryPath, entry.name);
    const metadata = await stat(absolutePath);

    output.push({
      path: absolutePath,
      releaseId,
      bytes: entry.isDirectory() ? await measureDirectorySize(absolutePath) : metadata.size,
      mtimeMs: metadata.mtimeMs,
    });
  }

  return output.sort((left, right) => left.path.localeCompare(right.path));
}

async function safeReadDirectory(directoryPath) {
  try {
    return await readdir(directoryPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function parseArchiveReleaseId(fileName, prefix) {
  if (!fileName.startsWith(prefix) || !fileName.endsWith('.tar.gz')) {
    return null;
  }

  const releaseId = fileName.slice(prefix.length, -'.tar.gz'.length).trim();
  return releaseId || null;
}

function parsePortableReleaseId(entryName) {
  const prefix = 'lume-hub-docker-desktop-';

  if (!entryName.startsWith(prefix)) {
    return null;
  }

  if (entryName.endsWith('.tar.gz')) {
    return entryName.slice(prefix.length, -'.tar.gz'.length).trim() || null;
  }

  if (entryName.endsWith('.zip')) {
    return entryName.slice(prefix.length, -'.zip'.length).trim() || null;
  }

  return entryName.slice(prefix.length).trim() || null;
}

function newestReleaseId(entries) {
  const newest = [...entries].sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
  return newest?.releaseId ?? null;
}

function newestPortableReleaseId(entries) {
  const newestByReleaseId = new Map();

  for (const entry of entries) {
    const existing = newestByReleaseId.get(entry.releaseId);
    if (!existing || entry.mtimeMs > existing.mtimeMs) {
      newestByReleaseId.set(entry.releaseId, entry);
    }
  }

  const newest = [...newestByReleaseId.values()].sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
  return newest?.releaseId ?? null;
}

async function measureDirectorySize(directoryPath) {
  let total = 0;
  const directoryEntries = await safeReadDirectory(directoryPath);

  for (const entry of directoryEntries) {
    const absolutePath = resolve(directoryPath, entry.name);

    if (entry.isDirectory()) {
      total += await measureDirectorySize(absolutePath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const metadata = await stat(absolutePath);
    total += metadata.size;
  }

  return total;
}

function formatSet(values) {
  return values.size > 0 ? [...values].sort().join(', ') : '(nenhum)';
}

function formatRelative(absolutePath) {
  return absolutePath.startsWith(`${REPO_ROOT}/`) ? absolutePath.slice(REPO_ROOT.length + 1) : absolutePath;
}

function formatBytes(value) {
  if (value < 1024) {
    return `${value} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let current = value;
  let unitIndex = -1;

  do {
    current /= 1024;
    unitIndex += 1;
  } while (current >= 1024 && unitIndex < units.length - 1);

  return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function filterTruthy(values) {
  return values.filter(Boolean);
}
