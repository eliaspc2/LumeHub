import { readFile } from 'node:fs/promises';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

import type { AutomationRunLog, AutomationRunRecord } from '../../domain/entities/Automation.js';

export class AutomationRunRepository {
  constructor(
    private readonly filePath: string,
    private readonly writer = new AtomicJsonWriter(),
  ) {}

  async read(): Promise<AutomationRunLog> {
    try {
      const value = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<AutomationRunLog>;
      return {
        runs: Array.isArray(value.runs) ? value.runs : [],
      };
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return {
          runs: [],
        };
      }

      throw error;
    }
  }

  async append(entry: AutomationRunRecord): Promise<void> {
    const current = await this.read();
    await this.writer.write(this.filePath, {
      runs: [...current.runs, entry].slice(-400),
    } satisfies AutomationRunLog);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
