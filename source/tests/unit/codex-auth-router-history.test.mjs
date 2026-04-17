import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { CodexAuthCanonicalWriter } = await import(
  '../../packages/modules/codex-auth-router/dist/modules/codex-auth-router/src/domain/services/CodexAuthCanonicalWriter.js'
);

test('codex auth canonical writer keeps only the last retained history snapshots per account', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-history-'));
  const canonicalAuthFilePath = join(sandboxPath, 'auth.json');
  const backupDirectoryPath = join(sandboxPath, 'backups');
  const sourceFilePath = join(sandboxPath, 'source.json');

  try {
    await mkdir(backupDirectoryPath, { recursive: true });
    await writeFile(canonicalAuthFilePath, '{"token":"one"}', 'utf8');
    await writeFile(sourceFilePath, '{"token":"two"}', 'utf8');

    const writer = new CodexAuthCanonicalWriter({
      canonicalAuthFilePath,
      backupDirectoryPath,
      historyRetentionLimit: 2,
    });

    await writer.writeFromSource(sourceFilePath, {
      now: new Date('2026-04-17T10:00:00.000Z'),
      previousAccountId: 'canonical-live',
    });

    await writeFile(sourceFilePath, '{"token":"three"}', 'utf8');
    await writer.writeFromSource(sourceFilePath, {
      now: new Date('2026-04-17T10:01:00.000Z'),
      previousAccountId: 'canonical-live',
    });

    await writeFile(sourceFilePath, '{"token":"four"}', 'utf8');
    await writer.writeFromSource(sourceFilePath, {
      now: new Date('2026-04-17T10:02:00.000Z'),
      previousAccountId: 'canonical-live',
    });

    const historyDirectoryPath = join(backupDirectoryPath, 'history', 'canonical-live');
    const historyFiles = (await readdir(historyDirectoryPath)).sort();
    const historyContents = await Promise.all(
      historyFiles.map((fileName) => readFile(join(historyDirectoryPath, fileName), 'utf8')),
    );
    const canonicalContents = await readFile(canonicalAuthFilePath, 'utf8');

    assert.equal(historyFiles.length, 2);
    assert.deepEqual(historyContents, ['{"token":"two"}', '{"token":"three"}']);
    assert.equal(canonicalContents, '{"token":"four"}');
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});
