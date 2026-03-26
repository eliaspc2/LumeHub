import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export interface CodexAuthCanonicalWriterConfig {
  readonly canonicalAuthFilePath: string;
  readonly backupDirectoryPath: string;
}

export interface CodexAuthWriteResult {
  readonly switched: boolean;
  readonly backupFilePath: string | null;
  readonly contentHash: string;
  readonly bytes: number;
}

export class CodexAuthCanonicalWriter {
  constructor(private readonly config: CodexAuthCanonicalWriterConfig) {}

  async writeFromSource(sourceFilePath: string, now = new Date()): Promise<CodexAuthWriteResult> {
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
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
