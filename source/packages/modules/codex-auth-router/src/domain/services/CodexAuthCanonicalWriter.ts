import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export interface CodexAuthCanonicalWriterConfig {
  readonly canonicalAuthFilePath: string;
  readonly backupDirectoryPath: string;
  readonly historyDirectoryPath?: string;
  readonly historyRetentionLimit?: number;
}

export interface CodexAuthWriteResult {
  readonly switched: boolean;
  readonly backupFilePath: string | null;
  readonly contentHash: string;
  readonly bytes: number;
}

export class CodexAuthCanonicalWriter {
  constructor(private readonly config: CodexAuthCanonicalWriterConfig) {}

  async writeFromSource(
    sourceFilePath: string,
    options: {
      readonly now?: Date;
      readonly previousAccountId?: string | null;
    } = {},
  ): Promise<CodexAuthWriteResult> {
    const now = options.now ?? new Date();
    const sourceContents = await readFile(sourceFilePath, 'utf8');
    const sourceHash = createHash('sha256').update(sourceContents).digest('hex');

    let currentContents: string | null = null;

    try {
      currentContents = await readFile(this.config.canonicalAuthFilePath, 'utf8');
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    }

    const currentHash = currentContents ? createHash('sha256').update(currentContents).digest('hex') : null;

    if (currentHash === sourceHash) {
      return {
        switched: false,
        backupFilePath: null,
        contentHash: sourceHash,
        bytes: Buffer.byteLength(sourceContents),
      };
    }

    await mkdir(dirname(this.config.canonicalAuthFilePath), { recursive: true });
    await mkdir(this.config.backupDirectoryPath, { recursive: true });

    let backupFilePath: string | null = null;

    if (currentContents !== null) {
      backupFilePath = join(
        this.config.backupDirectoryPath,
        `${now.toISOString().replaceAll(':', '-')}-${basename(this.config.canonicalAuthFilePath)}-${randomUUID()}.bak.json`,
      );
      await writeFile(backupFilePath, currentContents, 'utf8');
      await this.writeHistorySnapshot(currentContents, now, options.previousAccountId);
    }

    const temporaryPath = join(
      dirname(this.config.canonicalAuthFilePath),
      `${basename(this.config.canonicalAuthFilePath)}.${randomUUID()}.tmp`,
    );

    await writeFile(temporaryPath, sourceContents, 'utf8');
    await rename(temporaryPath, this.config.canonicalAuthFilePath);

    return {
      switched: true,
      backupFilePath,
      contentHash: sourceHash,
      bytes: Buffer.byteLength(sourceContents),
    };
  }

  private async writeHistorySnapshot(currentContents: string, now: Date, previousAccountId: string | null | undefined) {
    const historyDirectoryPath = this.config.historyDirectoryPath ?? join(this.config.backupDirectoryPath, 'history');
    const retentionLimit = normaliseRetentionLimit(this.config.historyRetentionLimit);
    const accountDirectoryPath = join(historyDirectoryPath, sanitisePathSegment(previousAccountId ?? 'canonical-live'));
    const historyFilePath = join(
      accountDirectoryPath,
      `${now.toISOString().replaceAll(':', '-')}-${basename(this.config.canonicalAuthFilePath)}-${randomUUID()}.json`,
    );

    await mkdir(accountDirectoryPath, { recursive: true });
    await writeFile(historyFilePath, currentContents, 'utf8');
    await pruneHistoryDirectory(accountDirectoryPath, retentionLimit);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function normaliseRetentionLimit(value: number | undefined): number {
  if (!Number.isInteger(value) || (value ?? 0) <= 0) {
    return 5;
  }

  return value as number;
}

function sanitisePathSegment(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]/g, '-');
}

async function pruneHistoryDirectory(directoryPath: string, retentionLimit: number): Promise<void> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();

  const staleFiles = files.slice(0, Math.max(0, files.length - retentionLimit));

  await Promise.all(staleFiles.map((fileName) => rm(join(directoryPath, fileName), { force: true })));
}
