import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface BaileysSessionStoreOptions {
  readonly authRootPath?: string;
}

export class BaileysSessionStore {
  private readonly authRootPath: string;

  constructor(options: BaileysSessionStoreOptions = {}) {
    this.authRootPath = options.authRootPath ?? 'runtime/whatsapp';
  }

  sessionDirectoryPathFor(accountId = 'default'): string {
    return join(this.authRootPath, accountId);
  }

  sessionPathFor(accountId = 'default'): string {
    return join(this.sessionDirectoryPathFor(accountId), 'creds.json');
  }

  async ensureSessionDirectory(accountId = 'default'): Promise<string> {
    const directoryPath = this.sessionDirectoryPathFor(accountId);
    await mkdir(directoryPath, { recursive: true });
    return directoryPath;
  }

  async readSession<TValue = Record<string, unknown>>(accountId = 'default'): Promise<TValue | undefined> {
    try {
      return JSON.parse(await readFile(this.sessionPathFor(accountId), 'utf8')) as TValue;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        return undefined;
      }

      throw error;
    }
  }

  async writeSession<TValue>(value: TValue, accountId = 'default'): Promise<void> {
    const targetPath = this.sessionPathFor(accountId);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }

  async clearSession(accountId = 'default'): Promise<void> {
    await rm(this.sessionDirectoryPathFor(accountId), { recursive: true, force: true });
  }

  async hasSession(accountId = 'default'): Promise<boolean> {
    const directoryPath = this.sessionDirectoryPathFor(accountId);

    try {
      const entries = await readdir(directoryPath);
      return entries.length > 0;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        return false;
      }

      throw error;
    }
  }
}
