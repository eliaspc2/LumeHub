import { readFile } from 'node:fs/promises';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

import type { AutomationFiredState } from '../../domain/entities/Automation.js';

export class AutomationFiredStateRepository {
  constructor(
    private readonly filePath: string,
    private readonly writer = new AtomicJsonWriter(),
  ) {}

  async read(): Promise<AutomationFiredState> {
    try {
      const value = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<AutomationFiredState>;
      return {
        fired: typeof value.fired === 'object' && value.fired !== null ? value.fired : {},
      };
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return {
          fired: {},
        };
      }

      throw error;
    }
  }

  async save(state: AutomationFiredState): Promise<void> {
    await this.writer.write(this.filePath, state);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
