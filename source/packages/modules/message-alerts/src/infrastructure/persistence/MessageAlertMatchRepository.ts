import { readFile } from 'node:fs/promises';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

import type { MessageAlertMatchLog, MessageAlertMatchRecord } from '../../domain/entities/MessageAlert.js';

export class MessageAlertMatchRepository {
  constructor(
    private readonly filePath: string,
    private readonly writer = new AtomicJsonWriter(),
  ) {}

  async read(): Promise<MessageAlertMatchLog> {
    try {
      const value = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<MessageAlertMatchLog>;
      return {
        matches: Array.isArray(value.matches) ? value.matches : [],
      };
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return {
          matches: [],
        };
      }

      throw error;
    }
  }

  async append(entry: MessageAlertMatchRecord): Promise<void> {
    const current = await this.read();
    const nextMatches = [...current.matches, entry].slice(-200);
    await this.writer.write(this.filePath, {
      matches: nextMatches,
    } satisfies MessageAlertMatchLog);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
