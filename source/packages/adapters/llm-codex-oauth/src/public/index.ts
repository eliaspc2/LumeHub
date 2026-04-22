import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import type { CodexAuthRouterModuleContract, CodexFailureKind } from '@lume-hub/codex-auth-router';
import {
  buildWaNotifyChatInstructions,
  buildWaNotifyScheduleInstructions,
  buildWaNotifyStorageReferenceInstructions,
  buildWaNotifyWeeklyPlanningInstructions,
} from '@lume-hub/llm-orchestrator';
import type {
  LlmChatInput,
  LlmChatResult,
  LlmModelCatalogRefreshResult,
  LlmModelDescriptor,
  LlmProvider,
  LlmRefreshableProvider,
  LlmScheduleCandidate,
  LlmScheduleParseInput,
  LlmScheduleParseResult,
  WeeklyPromptPlan,
  WeeklyPromptPlanningInput,
} from '@lume-hub/llm-orchestrator';

const DEFAULT_CODEX_OAUTH_MODEL = 'gpt-5.4';
const DEFAULT_CODEX_CLIENT_VERSION = '0.116.0';

type FetchLike = typeof fetch;

interface CodexAuthJson {
  readonly tokens?: {
    readonly access_token?: string;
    readonly account_id?: string;
  };
}

interface CodexVersionJson {
  readonly version?: string;
  readonly latest_version?: string;
}

interface CodexModelsCatalogEntry {
  readonly slug?: string;
  readonly supported_in_api?: boolean;
  readonly visibility?: string;
  readonly priority?: number;
}

interface CodexModelsCatalogResponse {
  readonly models?: readonly CodexModelsCatalogEntry[];
}

interface CodexEventPayload {
  readonly type?: string;
  readonly delta?: string;
  readonly text?: string;
  readonly detail?: string;
  readonly error?: { readonly message?: string } | string;
  readonly response?: {
    readonly error?: { readonly message?: string } | string;
    readonly output?: ReadonlyArray<{
      readonly type?: string;
      readonly text?: string;
      readonly content?: ReadonlyArray<{
        readonly type?: string;
        readonly text?: string;
      }>;
    }>;
  };
}

interface LoadedCodexAuth {
  readonly accessToken: string;
  readonly accountId?: string;
  readonly authFilePath: string;
}

interface PreparedCodexSelection {
  readonly accountId: string | null;
  readonly authFilePath: string;
}

export interface CodexOauthLlmProviderConfig {
  readonly enabled?: boolean;
  readonly providerId?: string;
  readonly authFilePath?: string;
  readonly authRouter?: Pick<
    CodexAuthRouterModuleContract,
    'prepareAuthForRequest' | 'reportFailure' | 'reportSuccess'
  >;
  readonly clientVersion?: string;
  readonly defaultModelId?: string;
  readonly modelResolver?: () => Promise<string | null | undefined> | string | null | undefined;
  readonly fetchImpl?: FetchLike;
}

export interface LlmCodexOauthAdapterConfig extends CodexOauthLlmProviderConfig {}

export class CodexOauthLlmProvider implements LlmProvider, LlmRefreshableProvider {
  readonly providerId: string;
  readonly defaultModelId: string;
  private readonly fetchImpl: FetchLike;
  private cachedModels: readonly LlmModelDescriptor[];

  constructor(private readonly config: CodexOauthLlmProviderConfig = {}) {
    this.providerId = config.providerId ?? 'codex-oauth';
    this.defaultModelId = config.defaultModelId ?? DEFAULT_CODEX_OAUTH_MODEL;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.cachedModels = buildModelCatalog(this.providerId, [this.defaultModelId], {
      streaming: true,
    });
  }

  listModels(): readonly LlmModelDescriptor[] {
    return this.cachedModels;
  }

  async refreshModels(): Promise<LlmModelCatalogRefreshResult> {
    const catalog = await this.withPreparedSelection('llm_refresh_models', async (selection) => {
      const auth = loadCodexAuth(selection.authFilePath);
      const clientVersion = resolveCodexClientVersion(selection.authFilePath, this.config.clientVersion);
      const url = new URL('https://chatgpt.com/backend-api/codex/models');
      url.searchParams.set('client_version', clientVersion);

      const response = await this.fetchImpl(url, {
        headers: {
          authorization: `Bearer ${auth.accessToken}`,
          accept: 'application/json',
          'user-agent': 'LumeHub',
          ...(auth.accountId ? { 'chatgpt-account-id': auth.accountId } : {}),
        },
      });
      const raw = await response.text();

      if (!response.ok) {
        throw new Error(`OPENAI_CODEX_OAUTH models error ${response.status}: ${extractBestErrorMessage(raw)}`);
      }

      const parsed = JSON.parse(raw) as CodexModelsCatalogResponse;
      const models = uniqueStrings(
        [...(parsed.models ?? [])]
          .sort((left, right) => numericOrMax(left.priority) - numericOrMax(right.priority))
          .filter((model) => model.supported_in_api !== false)
          .map((model) => model.slug),
      );

      return buildModelCatalog(this.providerId, models.length > 0 ? models : [this.defaultModelId], {
        streaming: true,
      });
    });

    this.cachedModels = catalog;
    return {
      providerId: this.providerId,
      models: this.cachedModels,
    };
  }

  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    const modelId = await this.resolveModelId();
    const text = await this.runTextPrompt({
      modelId,
      reason: 'llm_chat',
      instructions: buildGeneralChatInstructions(),
      userText: buildGeneralChatUserText(input),
    });

    return {
      runId: `codex-oauth-run-${randomUUID()}`,
      providerId: this.providerId,
      modelId,
      text,
    };
  }

  async parseSchedules(input: LlmScheduleParseInput): Promise<LlmScheduleParseResult> {
    const modelId = await this.resolveModelId();
    const payload = await this.runJsonPrompt<{
      readonly candidates?: readonly Partial<LlmScheduleCandidate>[];
      readonly notes?: readonly string[];
    }>({
      modelId,
      reason: 'llm_parse_schedules',
      instructions: buildScheduleInstructions(),
      userText: buildScheduleUserText(input),
    });

    return {
      candidates: sanitiseScheduleCandidates(payload.candidates),
      notes: sanitiseStringArray(payload.notes),
    };
  }

  async planWeeklyPrompts(input: WeeklyPromptPlanningInput): Promise<WeeklyPromptPlan> {
    const modelId = await this.resolveModelId();
    const payload = await this.runJsonPrompt<{
      readonly weekId?: string;
      readonly prompts?: readonly string[];
    }>({
      modelId,
      reason: 'llm_plan_weekly_prompts',
      instructions: buildWeeklyPlanningInstructions(),
      userText: buildWeeklyPlanningUserText(input),
    });

    return {
      weekId: payload.weekId?.trim() || input.weekId,
      prompts: sanitiseStringArray(payload.prompts),
    };
  }

  private async runJsonPrompt<TPayload>(input: {
    readonly modelId: string;
    readonly reason: string;
    readonly instructions: string;
    readonly userText: string;
  }): Promise<TPayload> {
    const responseText = await this.runTextPrompt(input);

    try {
      return JSON.parse(extractJsonBlock(responseText)) as TPayload;
    } catch (error) {
      throw new Error(`OPENAI_CODEX_OAUTH JSON invalido: ${toErrorMessage(error)}`);
    }
  }

  private async runTextPrompt(input: {
    readonly modelId: string;
    readonly reason: string;
    readonly instructions: string;
    readonly userText: string;
  }): Promise<string> {
    return this.withPreparedSelection(input.reason, async (selection) => {
      const auth = loadCodexAuth(selection.authFilePath);
      const response = await this.fetchImpl('https://chatgpt.com/backend-api/codex/responses', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${auth.accessToken}`,
          accept: 'text/event-stream',
          'user-agent': 'LumeHub',
          ...(auth.accountId ? { 'chatgpt-account-id': auth.accountId } : {}),
        },
        body: JSON.stringify({
          model: input.modelId,
          instructions: input.instructions,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: input.userText,
                },
              ],
            },
          ],
          stream: true,
          store: false,
        }),
      });
      const raw = await response.text();

      if (!response.ok) {
        throw new Error(`OPENAI_CODEX_OAUTH error ${response.status}: ${extractBestErrorMessage(raw)}`);
      }

      const parsed = parseCodexSse(raw);
      const text = parsed.text.trim();

      if (parsed.streamError && !text) {
        throw new Error(`OPENAI_CODEX_OAUTH stream error: ${parsed.streamError}`);
      }

      if (!text) {
        throw new Error('OPENAI_CODEX_OAUTH resposta vazia.');
      }

      return text;
    });
  }

  private async resolveModelId(): Promise<string> {
    const resolved = this.config.modelResolver ? await this.config.modelResolver() : undefined;
    const trimmed = typeof resolved === 'string' ? resolved.trim() : '';
    return trimmed || this.defaultModelId;
  }

  private async withPreparedSelection<TValue>(
    reason: string,
    operation: (selection: PreparedCodexSelection) => Promise<TValue>,
  ): Promise<TValue> {
    const selection = this.config.authRouter
      ? await this.config.authRouter.prepareAuthForRequest({
          reason,
        })
      : null;
    const preparedSelection: PreparedCodexSelection = {
      accountId: selection?.accountId ?? null,
      authFilePath: selection?.canonicalAuthFilePath ?? resolveCodexAuthFile(this.config.authFilePath),
    };

    try {
      const result = await operation(preparedSelection);
      await this.config.authRouter?.reportSuccess({
        accountId: preparedSelection.accountId,
        reason,
      });
      return result;
    } catch (error) {
      await this.config.authRouter
        ?.reportFailure({
          accountId: preparedSelection.accountId,
          reason: toErrorMessage(error),
          failureKind: classifyCodexFailureKind(error),
        })
        .catch(() => undefined);
      throw error;
    }
  }
}

export class LlmCodexOauthAdapter {
  constructor(readonly config: LlmCodexOauthAdapterConfig = {}) {}

  createProvider(): CodexOauthLlmProvider {
    return new CodexOauthLlmProvider(this.config);
  }

  describe(): Readonly<Record<string, unknown>> {
    return {
      adapter: 'llm-codex-oauth',
      enabled: this.config.enabled ?? true,
      providerId: this.config.providerId ?? 'codex-oauth',
      defaultModelId: this.config.defaultModelId ?? DEFAULT_CODEX_OAUTH_MODEL,
    };
  }
}

function buildGeneralChatInstructions(): string {
  return [
    'Es o assistente operacional do LumeHub.',
    'Responde sempre em portugues europeu.',
    'Mantem-te claro, util e direto.',
    'Usa apenas o contexto fornecido e nao inventes factos.',
    'Se faltarem dados para responder com seguranca, diz isso de forma humana.',
    '',
    buildWaNotifyChatInstructions(),
  ].join('\n');
}

function buildGeneralChatUserText(input: LlmChatInput): string {
  return [
    'Mensagem do utilizador:',
    input.text.trim(),
    '',
    'Intencao detetada:',
    input.intent?.trim() || 'desconhecida',
    '',
    'Resumo de contexto:',
    formatBullets(input.contextSummary),
    '',
    'Factos de dominio:',
    formatBullets(input.domainFacts),
    '',
    'Memoria de grupo:',
    formatMemoryScope(input.memoryScope),
  ].join('\n');
}

function buildScheduleInstructions(): string {
  return [
    'Analisa o pedido e devolve apenas JSON valido.',
    'Formato exato: {"candidates":[{"title":"string","dateHint":"YYYY-MM-DD|null","timeHint":"HH:MM|null","confidence":"low|medium|high","notes":["string"]}],"notes":["string"]}.',
    'Nao escrevas markdown nem texto fora do JSON.',
    'Se nao conseguires inferir uma data ou hora, usa null.',
    '',
    buildWaNotifyScheduleInstructions(),
    '',
    buildWaNotifyStorageReferenceInstructions(),
  ].join('\n');
}

function buildScheduleUserText(input: LlmScheduleParseInput): string {
  return [
    `Texto: ${input.text.trim()}`,
    `Data de referencia: ${input.referenceDate?.trim() || 'nao indicada'}`,
    `Timezone: ${input.timezone?.trim() || 'nao indicada'}`,
    'Resumo de contexto:',
    formatBullets(input.contextSummary),
    'Factos de dominio:',
    formatBullets(input.domainFacts),
    'Memoria de grupo:',
    formatMemoryScope(input.memoryScope),
  ].join('\n');
}

function formatMemoryScope(input: LlmChatInput['memoryScope'] | LlmScheduleParseInput['memoryScope']): string {
  if (!input || input.scope !== 'group') {
    return '- sem memoria especifica de grupo';
  }

  const lines = [
    `- grupo=${input.groupLabel ?? input.groupJid ?? 'desconhecido'}`,
    `- instructions_source=${input.instructionsSource ?? 'sem fonte'}`,
    `- instructions_applied=${input.instructionsApplied ? 'sim' : 'nao'}`,
    `- knowledge_snippets=${input.knowledgeSnippetCount}`,
  ];
  const instructions = String(input.instructionsContent ?? '').trim();
  const instructionLines =
    input.instructionsApplied && instructions
      ? [
          '- instrucoes_canonicas_do_grupo:',
          truncateForPrompt(instructions, 1800),
        ]
      : [];

  const documents = input.knowledgeDocuments
    .slice(0, 3)
    .map((document) => `- doc=${document.documentId} | ${document.title} | ${document.filePath}`);

  return [...lines, ...instructionLines, ...documents].join('\n');
}

function buildWeeklyPlanningInstructions(): string {
  return [
    'Produz apenas JSON valido.',
    'Formato exato: {"weekId":"string","prompts":["string"]}.',
    'Os prompts devem ser operacionais, curtos e prontos a enviar.',
    'Nao escrevas markdown nem texto fora do JSON.',
    '',
    buildWaNotifyWeeklyPlanningInstructions(),
  ].join('\n');
}

function buildWeeklyPlanningUserText(input: WeeklyPromptPlanningInput): string {
  return [
    `WeekId: ${input.weekId}`,
    `Quantidade pedida: ${input.requestedCount ?? 3}`,
    'Itens:',
    input.items && input.items.length > 0
      ? input.items
          .map((item) => `- ${item.title} | ${item.dueAt} | grupo=${item.groupLabel ?? 'sem grupo'}`)
          .join('\n')
      : '- sem itens',
  ].join('\n');
}

function extractJsonBlock(raw: string): string {
  const trimmed = raw.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  const fencedMatch = /```(?:json)?\s*([\s\S]*?)```/iu.exec(trimmed);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function sanitiseScheduleCandidates(
  input: readonly Partial<LlmScheduleCandidate>[] | undefined,
): readonly LlmScheduleCandidate[] {
  return (input ?? [])
    .map((candidate) => ({
      title: String(candidate.title ?? '').trim(),
      dateHint: normaliseNullableString(candidate.dateHint),
      timeHint: normaliseNullableString(candidate.timeHint),
      confidence: normaliseConfidence(candidate.confidence),
      notes: sanitiseStringArray(candidate.notes),
    }))
    .filter((candidate) => candidate.title.length > 0);
}

function sanitiseStringArray(input: readonly unknown[] | undefined): readonly string[] {
  return uniqueStrings((input ?? []).map((value) => String(value ?? '').trim()).filter(Boolean));
}

function normaliseConfidence(value: unknown): LlmScheduleCandidate['confidence'] {
  switch (String(value ?? '').trim()) {
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    default:
      return 'low';
  }
}

function normaliseNullableString(value: unknown): string | null {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
}

function formatBullets(items: readonly string[] | undefined): string {
  if (!items || items.length === 0) {
    return '- sem dados';
  }

  return items.map((item) => `- ${item}`).join('\n');
}

function truncateForPrompt(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function buildModelCatalog(
  providerId: string,
  modelIds: readonly string[],
  options: {
    readonly streaming: boolean;
  },
): readonly LlmModelDescriptor[] {
  return uniqueStrings(modelIds)
    .filter(Boolean)
    .map((modelId) => ({
      providerId,
      modelId,
      label: modelId,
      capabilities: {
        chat: true,
        scheduling: true,
        weeklyPlanning: true,
        streaming: options.streaming,
      },
    }));
}

function resolveCodexAuthFile(explicitAuthFilePath?: string): string {
  const trimmed = explicitAuthFilePath?.trim();

  if (trimmed) {
    return resolve(expandHome(trimmed));
  }

  const codexHome = process.env.CODEX_HOME?.trim() ? expandHome(process.env.CODEX_HOME) : join(homedir(), '.codex');
  return join(codexHome, 'auth.json');
}

function loadCodexAuth(authFilePath?: string): LoadedCodexAuth {
  const resolvedPath = resolveCodexAuthFile(authFilePath);
  const parsed = JSON.parse(readFileSync(resolvedPath, 'utf8')) as CodexAuthJson;
  const accessToken = parsed.tokens?.access_token?.trim();

  if (!accessToken) {
    throw new Error(`Credenciais OAuth do Codex invalidas em ${resolvedPath} (access_token em falta).`);
  }

  return {
    accessToken,
    accountId: parsed.tokens?.account_id?.trim() || undefined,
    authFilePath: resolvedPath,
  };
}

function resolveCodexClientVersion(authFilePath?: string, preferredClientVersion?: string): string {
  if (isValidClientVersion(preferredClientVersion)) {
    return preferredClientVersion!.trim();
  }

  if (isValidClientVersion(process.env.LLM_CODEX_CLIENT_VERSION)) {
    return process.env.LLM_CODEX_CLIENT_VERSION!.trim();
  }

  const versionFilePath = join(dirname(resolveCodexAuthFile(authFilePath)), 'version.json');

  try {
    const parsed = JSON.parse(readFileSync(versionFilePath, 'utf8')) as CodexVersionJson;

    if (isValidClientVersion(parsed.version)) {
      return parsed.version!.trim();
    }

    if (isValidClientVersion(parsed.latest_version)) {
      return parsed.latest_version!.trim();
    }
  } catch {}

  return DEFAULT_CODEX_CLIENT_VERSION;
}

function isValidClientVersion(value: string | undefined | null): boolean {
  const trimmed = String(value ?? '').trim();
  return /^\d+\.\d+\.\d+$/u.test(trimmed) || /^\d{4}\.\d{2}\.\d{2}$/u.test(trimmed);
}

function expandHome(inputPath: string): string {
  if (inputPath === '~') {
    return homedir();
  }

  if (inputPath.startsWith('~/')) {
    return join(homedir(), inputPath.slice(2));
  }

  return inputPath;
}

function extractBestErrorMessage(raw: string): string {
  const trimmed = raw.trim();

  if (!trimmed) {
    return '(resposta vazia)';
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const error = parsed.error;
    const errorMessage =
      error && typeof error === 'object' && 'message' in error ? (error as { readonly message?: unknown }).message : null;
    const directMessage =
      (typeof parsed.detail === 'string' && parsed.detail) ||
      (typeof parsed.message === 'string' && parsed.message) ||
      (typeof errorMessage === 'string' && errorMessage);

    if (directMessage) {
      return directMessage;
    }
  } catch {}

  return trimmed.length > 800 ? `${trimmed.slice(0, 800)}...` : trimmed;
}

function parseCodexSse(raw: string): {
  readonly text: string;
  readonly streamError?: string;
} {
  const chunks: string[] = [];
  let currentDataLines: string[] = [];

  for (const line of raw.split(/\r?\n/u)) {
    if (!line.trim()) {
      if (currentDataLines.length > 0) {
        chunks.push(currentDataLines.join('\n'));
        currentDataLines = [];
      }
      continue;
    }

    if (line.startsWith('data:')) {
      currentDataLines.push(line.slice(5).trimStart());
    }
  }

  if (currentDataLines.length > 0) {
    chunks.push(currentDataLines.join('\n'));
  }

  let text = '';
  let completedText = '';
  let streamError: string | undefined;

  for (const chunk of chunks) {
    const payloadRaw = chunk.trim();

    if (!payloadRaw || payloadRaw === '[DONE]') {
      continue;
    }

    let payload: CodexEventPayload;

    try {
      payload = JSON.parse(payloadRaw) as CodexEventPayload;
    } catch {
      continue;
    }

    const maybeStreamError = extractStreamError(payload);

    if (maybeStreamError) {
      streamError = maybeStreamError;
    }

    if (payload.type === 'response.output_text.delta' && typeof payload.delta === 'string') {
      text += payload.delta;
      continue;
    }

    if (payload.type === 'response.output_text.done' && typeof payload.text === 'string' && !text) {
      text = payload.text;
      continue;
    }

    if (payload.type === 'response.completed') {
      completedText = extractCompletedText(payload);
    }
  }

  return {
    text: text || completedText,
    ...(streamError ? { streamError } : {}),
  };
}

function extractStreamError(payload: CodexEventPayload): string | null {
  if (typeof payload.detail === 'string' && payload.detail.trim()) {
    return payload.detail.trim();
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim();
  }

  if (payload.error && typeof payload.error === 'object' && typeof payload.error.message === 'string') {
    return payload.error.message.trim();
  }

  if (
    payload.response?.error &&
    typeof payload.response.error === 'object' &&
    typeof payload.response.error.message === 'string' &&
    payload.response.error.message.trim()
  ) {
    return payload.response.error.message.trim();
  }

  return null;
}

function extractCompletedText(payload: CodexEventPayload): string {
  const output = payload.response?.output;

  if (!output || output.length === 0) {
    return '';
  }

  const parts: string[] = [];

  for (const item of output) {
    if (typeof item.text === 'string' && item.text) {
      parts.push(item.text);
    }

    for (const content of item.content ?? []) {
      if (typeof content.text === 'string' && content.text) {
        parts.push(content.text);
      }
    }
  }

  return parts.join('');
}

function classifyCodexFailureKind(error: unknown): CodexFailureKind {
  const message = toErrorMessage(error).toLowerCase();

  if (message.includes('error 401') || message.includes('error 403') || message.includes('unauthor')) {
    return 'auth';
  }

  if (
    message.includes('error 402') ||
    message.includes('quota') ||
    message.includes('insufficient') ||
    message.includes('usage limit') ||
    message.includes('billing')
  ) {
    return 'quota';
  }

  if (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econn') ||
    message.includes('enotfound') ||
    message.includes('eai_again')
  ) {
    return 'network';
  }

  return 'unknown';
}

function numericOrMax(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function uniqueStrings(values: readonly (string | undefined | null)[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = String(value ?? '').trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    output.push(trimmed);
  }

  return output;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
