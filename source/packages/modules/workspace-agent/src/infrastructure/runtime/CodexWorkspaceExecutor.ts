import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

import type {
  WorkspaceAgentExecutionInput,
  WorkspaceAgentExecutionResult,
  WorkspaceAgentExecutor,
  WorkspaceAgentFileChangeType,
  WorkspaceAgentFileDiff,
  WorkspaceAgentStructuredSummary,
} from '../../domain/entities/WorkspaceAgent.js';

const execFileAsync = promisify(execFile);
const SUMMARY_BEGIN = 'LUMEHUB_WORKSPACE_SUMMARY_BEGIN';
const SUMMARY_END = 'LUMEHUB_WORKSPACE_SUMMARY_END';
const MAX_DIFF_SOURCE_BYTES = 160_000;
const MAX_DIFF_TEXT_LENGTH = 40_000;

interface ParsedWorkspaceSummary {
  readonly summary: string;
  readonly suggestedFiles: readonly string[];
  readonly readFiles: readonly string[];
  readonly notes: readonly string[];
}

interface FileSnapshot {
  readonly kind: 'missing' | 'text' | 'binary' | 'too_large';
  readonly content: string | null;
}

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
    const beforeSnapshots = await captureWorkspaceSnapshots(input.workspaceRootPath);
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
      const afterSnapshots = await captureWorkspaceSnapshots(input.workspaceRootPath);

      return buildExecutionResult({
        workspaceRootPath: input.workspaceRootPath,
        mode: input.mode,
        suggestedFiles: input.filePaths,
        beforeStatus,
        afterStatus,
        beforeSnapshots,
        afterSnapshots,
        stdout,
        stderr,
        exitCode: 0,
        timedOut: false,
      });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException & {
        readonly code?: number | string;
        readonly stdout?: string;
        readonly stderr?: string;
        readonly killed?: boolean;
      };
      const afterStatus = await readGitStatusMap(input.workspaceRootPath).catch(() => beforeStatus);
      const afterSnapshots = await captureWorkspaceSnapshots(input.workspaceRootPath).catch(() => beforeSnapshots);

      return buildExecutionResult({
        workspaceRootPath: input.workspaceRootPath,
        mode: input.mode,
        suggestedFiles: input.filePaths,
        beforeStatus,
        afterStatus,
        beforeSnapshots,
        afterSnapshots,
        stdout: typeof nodeError.stdout === 'string' ? nodeError.stdout : '',
        stderr: typeof nodeError.stderr === 'string' ? nodeError.stderr : nodeError.message,
        exitCode: typeof nodeError.code === 'number' ? nodeError.code : null,
        timedOut: Boolean(nodeError.killed),
      });
    }
  }
}

async function buildExecutionResult(input: {
  readonly workspaceRootPath: string;
  readonly mode: WorkspaceAgentExecutionInput['mode'];
  readonly suggestedFiles: readonly string[];
  readonly beforeStatus: Map<string, string>;
  readonly afterStatus: Map<string, string>;
  readonly beforeSnapshots: Map<string, FileSnapshot>;
  readonly afterSnapshots: Map<string, FileSnapshot>;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
}): Promise<WorkspaceAgentExecutionResult> {
  const changedFiles = diffWorkspaceSnapshots(input.beforeSnapshots, input.afterSnapshots);
  const fileDiffs = await collectFileDiffs({
    changedFiles,
    beforeStatus: input.beforeStatus,
    afterStatus: input.afterStatus,
    beforeSnapshots: input.beforeSnapshots,
    afterSnapshots: input.afterSnapshots,
  });
  const parsedSummary = parseWorkspaceSummary(input.stdout) ?? parseWorkspaceSummary(input.stderr);
  const stdout = stripWorkspaceSummaryBlock(input.stdout);
  const stderr = stripWorkspaceSummaryBlock(input.stderr);
  const structuredSummary = normalizeParsedSummary({
    parsedSummary,
    workspaceRootPath: input.workspaceRootPath,
    suggestedFiles: input.suggestedFiles,
    changedFiles,
    stdout,
    stderr,
    mode: input.mode,
  });

  return {
    stdout,
    stderr,
    exitCode: input.exitCode,
    timedOut: input.timedOut,
    outputSummary: structuredSummary.summary,
    changedFiles,
    structuredSummary,
    fileDiffs,
  };
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

async function captureWorkspaceSnapshots(workspaceRootPath: string): Promise<Map<string, FileSnapshot>> {
  const filePaths = await listWorkspaceFiles(workspaceRootPath);
  const snapshots = new Map<string, FileSnapshot>();

  for (const relativePath of filePaths) {
    snapshots.set(relativePath, await readWorkspaceFileSnapshot(resolve(workspaceRootPath, relativePath)));
  }

  return snapshots;
}

async function listWorkspaceFiles(workspaceRootPath: string): Promise<readonly string[]> {
  const { stdout } = await execFileAsync(
    'git',
    ['-C', workspaceRootPath, 'ls-files', '--cached', '--others', '--exclude-standard'],
    {
      cwd: workspaceRootPath,
      encoding: 'utf8',
      maxBuffer: 2_000_000,
    },
  );

  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.endsWith('/'))
    .sort((left, right) => left.localeCompare(right));
}

async function readWorkspaceFileSnapshot(absolutePath: string): Promise<FileSnapshot> {
  try {
    const buffer = await readFile(absolutePath);

    if (buffer.byteLength > MAX_DIFF_SOURCE_BYTES) {
      return {
        kind: 'too_large',
        content: null,
      };
    }

    if (buffer.includes(0)) {
      return {
        kind: 'binary',
        content: null,
      };
    }

    return {
      kind: 'text',
      content: buffer.toString('utf8'),
    };
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return {
        kind: 'missing',
        content: null,
      };
    }

    throw error;
  }
}

function diffWorkspaceSnapshots(
  beforeSnapshots: Map<string, FileSnapshot>,
  afterSnapshots: Map<string, FileSnapshot>,
): readonly string[] {
  const changedPaths = new Set<string>();
  const paths = new Set<string>([...beforeSnapshots.keys(), ...afterSnapshots.keys()]);

  for (const path of paths) {
    const beforeSnapshot = beforeSnapshots.get(path) ?? { kind: 'missing', content: null };
    const afterSnapshot = afterSnapshots.get(path) ?? { kind: 'missing', content: null };

    if (beforeSnapshot.kind !== afterSnapshot.kind || beforeSnapshot.content !== afterSnapshot.content) {
      changedPaths.add(path);
    }
  }

  return [...changedPaths].sort((left, right) => left.localeCompare(right));
}

async function collectFileDiffs(input: {
  readonly changedFiles: readonly string[];
  readonly beforeStatus: Map<string, string>;
  readonly afterStatus: Map<string, string>;
  readonly beforeSnapshots: Map<string, FileSnapshot>;
  readonly afterSnapshots: Map<string, FileSnapshot>;
}): Promise<readonly WorkspaceAgentFileDiff[]> {
  const fileDiffs: WorkspaceAgentFileDiff[] = [];

  for (const relativePath of input.changedFiles) {
    const beforeSnapshot = input.beforeSnapshots.get(relativePath) ?? { kind: 'missing', content: null };
    const afterSnapshot = input.afterSnapshots.get(relativePath) ?? { kind: 'missing', content: null };
    const beforeStatus = input.beforeStatus.get(relativePath) ?? null;
    const afterStatus = input.afterStatus.get(relativePath) ?? null;

    fileDiffs.push({
      relativePath,
      changeType: determineChangeType(beforeSnapshot, afterSnapshot),
      beforeStatus,
      afterStatus,
      diffText: await renderDiffText(relativePath, beforeSnapshot, afterSnapshot),
    });
  }

  return fileDiffs;
}

function determineChangeType(beforeSnapshot: FileSnapshot, afterSnapshot: FileSnapshot): WorkspaceAgentFileChangeType {
  if (beforeSnapshot.kind === 'missing' && afterSnapshot.kind !== 'missing') {
    return 'added';
  }

  if (beforeSnapshot.kind !== 'missing' && afterSnapshot.kind === 'missing') {
    return 'deleted';
  }

  return 'modified';
}

async function renderDiffText(relativePath: string, beforeSnapshot: FileSnapshot, afterSnapshot: FileSnapshot): Promise<string> {
  if (beforeSnapshot.kind === 'binary' || afterSnapshot.kind === 'binary') {
    return 'Diff textual indisponivel para ficheiro binario.';
  }

  if (beforeSnapshot.kind === 'too_large' || afterSnapshot.kind === 'too_large') {
    return 'Diff textual indisponivel porque o ficheiro excede o limite seguro desta vista.';
  }

  if (beforeSnapshot.kind === 'missing' && afterSnapshot.kind === 'missing') {
    return 'Nao foi possivel reconstruir o diff deste ficheiro.';
  }

  return await renderTextDiff(relativePath, beforeSnapshot.content ?? '', afterSnapshot.content ?? '');
}

async function renderTextDiff(relativePath: string, beforeContent: string, afterContent: string): Promise<string> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'lume-hub-workspace-diff-'));
  const beforePath = join(tempRoot, 'before', basenameForTempFile(relativePath));
  const afterPath = join(tempRoot, 'after', basenameForTempFile(relativePath));

  try {
    await writeFileTreeSafe(beforePath, beforeContent);
    await writeFileTreeSafe(afterPath, afterContent);

    try {
      const { stdout } = await execFileAsync(
        'git',
        [
          'diff',
          '--no-index',
          '--no-ext-diff',
          '--unified=3',
          '--label',
          `a/${relativePath}`,
          '--label',
          `b/${relativePath}`,
          beforePath,
          afterPath,
        ],
        {
          encoding: 'utf8',
          maxBuffer: 2_000_000,
        },
      );
      return truncateDiffText(stdout);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException & { readonly stdout?: string };

      if (typeof nodeError.stdout === 'string' && nodeError.stdout.trim().length > 0) {
        return truncateDiffText(nodeError.stdout);
      }

      return 'Nao foi possivel gerar o diff textual deste ficheiro.';
    }
  } finally {
    await rm(tempRoot, {
      recursive: true,
      force: true,
    }).catch(() => undefined);
  }
}

function basenameForTempFile(relativePath: string): string {
  return relativePath.replace(/[\\/]/gu, '__');
}

async function writeFileTreeSafe(absolutePath: string, content: string): Promise<void> {
  const directoryPath = dirname(absolutePath);
  await mkdir(directoryPath, {
    recursive: true,
  });
  await writeFile(absolutePath, content, 'utf8');
}

function truncateDiffText(diffText: string): string {
  if (diffText.length <= MAX_DIFF_TEXT_LENGTH) {
    return diffText;
  }

  return `${diffText.slice(0, MAX_DIFF_TEXT_LENGTH)}\n\n...[diff truncado]`;
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
    'No fim, escreve um bloco JSON entre os marcadores abaixo com este formato:',
    SUMMARY_BEGIN,
    '{"summary":"...","readFiles":["..."],"suggestedFiles":["..."],"notes":["..."]}',
    SUMMARY_END,
    'Usa apenas caminhos relativos ao repositório nesses arrays.',
    'O campo "summary" deve ser curto e humano.',
    'Em "readFiles", lista os ficheiros que leste ou inspecionaste para responder.',
    'Em "suggestedFiles", repete apenas os ficheiros que recebeste como foco ou que consideras foco principal.',
    'Em "notes", deixa 0 a 3 observacoes curtas.',
    '',
    fileSection,
    'Pedido do utilizador:',
    input.prompt,
  ].join('\n');
}

function parseWorkspaceSummary(output: string): ParsedWorkspaceSummary | null {
  const match = output.match(new RegExp(`${SUMMARY_BEGIN}\\s*([\\s\\S]*?)\\s*${SUMMARY_END}`, 'u'));

  if (!match) {
    return null;
  }

  const raw = stripMarkdownFence(match[1]?.trim() ?? '');

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
      suggestedFiles: readStringArray(parsed.suggestedFiles),
      readFiles: readStringArray(parsed.readFiles),
      notes: readStringArray(parsed.notes),
    };
  } catch {
    return null;
  }
}

function stripWorkspaceSummaryBlock(output: string): string {
  return output
    .replace(new RegExp(`\\s*${SUMMARY_BEGIN}[\\s\\S]*?${SUMMARY_END}\\s*`, 'gu'), '\n')
    .trim();
}

function stripMarkdownFence(value: string): string {
  const trimmed = value.trim();

  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '').trim();
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean))]
    : [];
}

function normalizeParsedSummary(input: {
  readonly parsedSummary: ParsedWorkspaceSummary | null;
  readonly workspaceRootPath: string;
  readonly suggestedFiles: readonly string[];
  readonly changedFiles: readonly string[];
  readonly stdout: string;
  readonly stderr: string;
  readonly mode: WorkspaceAgentExecutionInput['mode'];
}): WorkspaceAgentStructuredSummary {
  const fallbackSummary = summarizeCodexOutput(input.stdout, input.stderr, input.mode);
  const parsedSummary = input.parsedSummary;

  return {
    summary: parsedSummary?.summary?.trim().length ? parsedSummary.summary.trim() : fallbackSummary,
    suggestedFiles: normalizeWorkspacePaths(
      input.workspaceRootPath,
      parsedSummary?.suggestedFiles?.length ? parsedSummary.suggestedFiles : input.suggestedFiles,
    ),
    readFiles: normalizeWorkspacePaths(
      input.workspaceRootPath,
      parsedSummary?.readFiles?.length ? parsedSummary.readFiles : [...input.suggestedFiles, ...input.changedFiles],
    ),
    notes: [...new Set((parsedSummary?.notes ?? []).map((entry) => entry.trim()).filter(Boolean))],
  };
}

function normalizeWorkspacePaths(workspaceRootPath: string, filePaths: readonly string[]): readonly string[] {
  const normalized: string[] = [];

  for (const filePath of filePaths) {
    const trimmed = filePath.trim();

    if (!trimmed) {
      continue;
    }

    const absolutePath = resolve(workspaceRootPath, trimmed);
    const relativePath = relative(workspaceRootPath, absolutePath).replace(/\\/gu, '/');

    if (!relativePath || relativePath === '..' || relativePath.startsWith('../')) {
      continue;
    }

    normalized.push(relativePath);
  }

  return [...new Set(normalized)];
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
