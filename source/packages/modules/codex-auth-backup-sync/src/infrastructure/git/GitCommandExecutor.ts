import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitCommandExecutionOptions {
  readonly allowFailure?: boolean;
  readonly additionalConfig?: Readonly<Record<string, string>>;
}

export interface GitCommandExecutionResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export class GitCommandExecutor {
  constructor(private readonly gitBin = 'git') {}

  async execute(
    repositoryPath: string,
    args: readonly string[],
    options: GitCommandExecutionOptions = {},
  ): Promise<GitCommandExecutionResult> {
    const configArgs = Object.entries(options.additionalConfig ?? {}).flatMap(([key, value]) => ['-c', `${key}=${value}`]);

    try {
      const { stdout, stderr } = await execFileAsync(this.gitBin, [...configArgs, '-C', repositoryPath, ...args], {
        encoding: 'utf8',
        maxBuffer: 1_000_000,
      });

      return {
        stdout,
        stderr,
        exitCode: 0,
      };
    } catch (error) {
      const commandError = error as NodeJS.ErrnoException & {
        readonly code?: number | string;
        readonly stdout?: string;
        readonly stderr?: string;
      };
      const result = {
        stdout: commandError.stdout ?? '',
        stderr: commandError.stderr ?? commandError.message,
        exitCode: typeof commandError.code === 'number' ? commandError.code : 1,
      };

      if (options.allowFailure) {
        return result;
      }

      throw new Error(result.stderr || `Git command failed with exit code ${result.exitCode}.`);
    }
  }
}
