import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type {
  WorkspaceAgentExecutionInput,
  WorkspaceAgentExecutionResult,
  WorkspaceAgentExecutor,
} from '../../domain/entities/WorkspaceAgent.js';

const execFileAsync = promisify(execFile);

export interface CodexWorkspaceExecutorConfig {
  readonly codexCliPath?: string;
  readonly timeoutMs?: number;
  readonly maxBufferBytes?: number;
}

export class CodexWorkspaceExecutor implements WorkspaceAgentExecutor {
  private readonly codexCliPath: string;
  private readonly timeoutMs: number;
  private readonly maxBufferBytes: number;

  constructor(config: CodexWorkspaceExecutorConfig = {}) {
    this.codexCliPath = config.codexCliPath ?? '/usr/local/bin/codex';
    this.timeoutMs = config.timeoutMs ?? 8 * 60_000;
    this.maxBufferBytes = config.maxBufferBytes ?? 8_000_000;
  }

  async run(input: WorkspaceAgentExecutionInput): Promise<WorkspaceAgentExecutionResult> {
    const beforeStatus = await readGitStatusMap(input.workspaceRootPath);
    const prompt = buildCodexPrompt(input);

    try {
      const { stdout, stderr } = await execFileAsync(
        this.codexCliPath,
        [
          'exec',
          '--skip-git-repo-check',
          '--dangerously-bypass-approvals-and-sandbox',
          '-C',
          input.workspaceRootPath,
          prompt,
        ],
        {
          cwd: input.workspaceRootPath,
          encoding: 'utf8',
          timeout: this.timeoutMs,
          maxBuffer: this.maxBufferBytes,
        },
      );
      const afterStatus = await readGitStatusMap(input.workspaceRootPath);

      return {
        stdout,
        stderr,
        exitCode: 0,
        timedOut: false,
        outputSummary: summarizeCodexOutput(stdout, stderr, input.mode),
        changedFiles: diffGitStatusMaps(beforeStatus, afterStatus),
      };
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException & {
        readonly code?: number | string;
        readonly signal?: string;
        readonly stdout?: string;
        readonly stderr?: string;
        readonly killed?: boolean;
      };
      const afterStatus = await readGitStatusMap(input.workspaceRootPath).catch(() => beforeStatus);
      const stdout = typeof nodeError.stdout === 'string' ? nodeError.stdout : '';
      const stderr = typeof nodeError.stderr === 'string' ? nodeError.stderr : '';

      return {
        stdout,
        stderr,
        exitCode: typeof nodeError.code === 'number' ? nodeError.code : null,
        timedOut: Boolean(nodeError.killed),
        outputSummary: summarizeCodexOutput(stdout, stderr || nodeError.message, input.mode),
        changedFiles: diffGitStatusMaps(beforeStatus, afterStatus),
      };
    }
  }
}

async function readGitStatusMap(workspaceRootPath: string): Promise<Map<string, string>> {
  const { stdout } = await execFileAsync(
    'git',
    ['-C', workspaceRootPath, 'status', '--short', '--untracked-files=all'],
    {
      cwd: workspaceRootPath,
      encoding: 'utf8',
      maxBuffer: 2_000_000,
    },
  );
  const entries = new Map<string, string>();

  for (const line of stdout.split('\n')) {
    const trimmed = line.trimEnd();

    if (!trimmed) {
      continue;
    }

    const path = trimmed.slice(3).trim();
    entries.set(path, trimmed.slice(0, 2));
  }

  return entries;
}

function diffGitStatusMaps(beforeStatus: Map<string, string>, afterStatus: Map<string, string>): readonly string[] {
  const changedPaths = new Set<string>();

  for (const [path, status] of afterStatus.entries()) {
    if (beforeStatus.get(path) !== status) {
      changedPaths.add(path);
    }
  }

  for (const path of beforeStatus.keys()) {
    if (!afterStatus.has(path)) {
      changedPaths.add(path);
    }
  }

  return [...changedPaths].sort((left, right) => left.localeCompare(right));
}

function buildCodexPrompt(input: WorkspaceAgentExecutionInput): string {
  const header =
    input.mode === 'plan'
      ? 'Analisa o repositório LumeHub e responde com um plano curto. Nao edites ficheiros.'
      : 'Trabalha no repositório LumeHub e faz as alteracoes pedidas diretamente nos ficheiros relevantes.';
  const fileSection =
    input.filePaths.length > 0
      ? `Ficheiros sugeridos pelo utilizador:\n${input.filePaths.map((filePath) => `- ${filePath}`).join('\n')}\nPodes abrir outros ficheiros dentro do repositório se fizer sentido.\n`
      : 'Nao ha ficheiros pre-selecionados. Decide tu que ficheiros precisas de abrir dentro do repositório.\n';

  return [
    header,
    'Trabalha apenas dentro deste repositório.',
    'Nao toques em ficheiros fora do LumeHub.',
    'Nao faças commit, push, reset nem operacoes destrutivas de git.',
    'Se fizeres alteracoes, resume no fim o que mudou e em que ficheiros.',
    '',
    fileSection,
    'Pedido do utilizador:',
    input.prompt,
  ].join('\n');
}

function summarizeCodexOutput(stdout: string, stderr: string, mode: WorkspaceAgentExecutionInput['mode']): string {
  const candidate = [stdout, stderr]
    .flatMap((value) => value.split('\n'))
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (candidate) {
    return candidate.slice(0, 240);
  }

  return mode === 'plan' ? 'Plano concluido sem saida textual.' : 'Run concluido sem saida textual.';
}
