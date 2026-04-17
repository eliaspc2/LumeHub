import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const { CodexAuthBackupSyncService } = await import(
  '../../packages/modules/codex-auth-backup-sync/dist/modules/codex-auth-backup-sync/src/application/services/CodexAuthBackupSyncService.js'
);

test('codex auth backup sync mirrors retained history into a git repository without duplicate commits', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-auth-sync-'));
  const sourceHistoryDirectoryPath = join(sandboxPath, 'source-history');
  const repositoryPath = join(sandboxPath, 'repo');

  try {
    await mkdir(join(sourceHistoryDirectoryPath, 'canonical-live'), { recursive: true });
    await mkdir(repositoryPath, { recursive: true });
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: repositoryPath });
    await writeFile(join(repositoryPath, 'README.md'), '# Codex auth backups\n', 'utf8');
    await execFileAsync('git', ['add', 'README.md'], { cwd: repositoryPath });
    await execFileAsync(
      'git',
      ['-c', 'user.name=LumeHub Tests', '-c', 'user.email=lume-hub-tests@localhost', 'commit', '-m', 'Initial commit'],
      { cwd: repositoryPath },
    );

    await writeFile(join(sourceHistoryDirectoryPath, 'canonical-live', '2026-04-17T10-00-00.000Z-auth.json'), '{"token":"a"}');

    const service = new CodexAuthBackupSyncService({
      enabled: true,
      repositoryPath,
      sourceHistoryDirectoryPath,
      pushEnabled: false,
    });

    const firstSync = await service.syncNow(new Date('2026-04-17T10:01:00.000Z'));
    const mirroredContents = await readFile(
      join(repositoryPath, 'history', 'lume-hub', 'canonical-live', '2026-04-17T10-00-00.000Z-auth.json'),
      'utf8',
    );

    assert.equal(firstSync.outcome, 'synced');
    assert.equal(firstSync.changed, true);
    assert.equal(firstSync.pushed, false);
    assert.equal(mirroredContents, '{"token":"a"}');

    const secondSync = await service.syncNow(new Date('2026-04-17T10:02:00.000Z'));
    assert.equal(secondSync.outcome, 'noop');
    assert.equal(secondSync.changed, false);

    await rm(join(sourceHistoryDirectoryPath, 'canonical-live', '2026-04-17T10-00-00.000Z-auth.json'));
    const thirdSync = await service.syncNow(new Date('2026-04-17T10:03:00.000Z'));
    const status = await execFileAsync('git', ['status', '--short', '--', 'history/lume-hub'], { cwd: repositoryPath });
    const commitCount = await execFileAsync('git', ['rev-list', '--count', 'HEAD'], { cwd: repositoryPath });

    assert.equal(thirdSync.outcome, 'synced');
    assert.equal(thirdSync.changed, true);
    assert.equal(status.stdout.trim(), '');
    assert.equal(commitCount.stdout.trim(), '3');
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});
