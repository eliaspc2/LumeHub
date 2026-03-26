import { execFile } from 'node:child_process';

import type {
  TerminalCommandExecutionOptions,
  TerminalCommandResult,
} from '../../domain/entities/OwnerControl.js';

export class TerminalCommandExecutor {
  async execute(
    command: string,
    options: TerminalCommandExecutionOptions = {},
  ): Promise<TerminalCommandResult> {
    return new Promise((resolve) => {
      execFile(
        '/bin/bash',
        ['-lc', command],
        {
          encoding: 'utf8',
          timeout: options.timeoutMs ?? 5_000,
          maxBuffer: 1_000_000,
        },
        (error, stdout, stderr) => {
          if (!error) {
            resolve({
              stdout,
              stderr,
              exitCode: 0,
              signal: null,
              timedOut: false,
            });
            return;
          }

          const nodeError = error as NodeJS.ErrnoException & {
            readonly code?: number | string;
            readonly signal?: string;
            readonly killed?: boolean;
          };

          resolve({
            stdout,
            stderr,
            exitCode: typeof nodeError.code === 'number' ? nodeError.code : null,
            signal: nodeError.signal ?? null,
            timedOut: Boolean(nodeError.killed),
          });
        },
      );
    });
  }
}
