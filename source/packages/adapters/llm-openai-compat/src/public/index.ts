import { randomUUID } from 'node:crypto';

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

const DEFAULT_OPENAI_COMPAT_BASE_URL = 'https://api.openai.com';
const DEFAULT_OPENAI_COMPAT_MODEL = 'gpt-5.4-mini';

type FetchLike = typeof fetch;

interface OpenAiCompatChatCompletionsResponse {
  readonly id?: string;
  readonly choices?: ReadonlyArray<{
    readonly message?: {
      readonly content?: string | ReadonlyArray<{
        readonly type?: string;
        readonly text?: string;
      }>;
    };
  }>;
}

interface OpenAiCompatModelsResponse {
  readonly data?: ReadonlyArray<{
    readonly id?: string;
  }>;
}

export interface OpenAiCompatLlmProviderConfig {
  readonly enabled?: boolean;
  readonly providerId?: string;
  readonly baseUrl?: string;
  readonly apiKey?: string;
  readonly defaultModelId?: string;
  readonly modelResolver?: () => Promise<string | null | undefined> | string | null | undefined;
  readonly fetchImpl?: FetchLike;
}

export interface LlmOpenaiCompatAdapterConfig extends OpenAiCompatLlmProviderConfig {}

export class OpenAiCompatLlmProvider implements LlmProvider, LlmRefreshableProvider {
  readonly providerId: string;
  readonly defaultModelId: string;
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;
  private cachedModels: readonly LlmModelDescriptor[];

  constructor(private readonly config: OpenAiCompatLlmProviderConfig = {}) {
    this.providerId = config.providerId ?? 'openai-compat';
    this.defaultModelId = config.defaultModelId ?? DEFAULT_OPENAI_COMPAT_MODEL;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.baseUrl = normaliseBaseUrl(
      config.baseUrl ??
        process.env.LUME_HUB_OPENAI_BASE_URL ??
        process.env.OPENAI_BASE_URL ??
        DEFAULT_OPENAI_COMPAT_BASE_URL,
    );
    this.cachedModels = buildModelCatalog(this.providerId, [this.defaultModelId]);
  }

  listModels(): readonly LlmModelDescriptor[] {
    return this.cachedModels;
  }

  async refreshModels(): Promise<LlmModelCatalogRefreshResult> {
    const response = await this.fetchImpl(`${this.baseUrl}/v1/models`, {
      headers: this.buildHeaders(),
    });
    const raw = await response.text();

    if (!response.ok) {
      throw new Error(`OPENAI_COMPAT models error ${response.status}: ${extractBestErrorMessage(raw)}`);
    }

    const parsed = JSON.parse(raw) as OpenAiCompatModelsResponse;
    const modelIds = uniqueStrings(parsed.data?.map((row) => row.id) ?? []);
    this.cachedModels = buildModelCatalog(this.providerId, modelIds.length > 0 ? modelIds : [this.defaultModelId]);

    return {
      providerId: this.providerId,
      models: this.cachedModels,
    };
  }

  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    const modelId = await this.resolveModelId();
    const text = await this.runTextPrompt({
      modelId,
      instructions: buildGeneralChatInstructions(),
      userText: buildGeneralChatUserText(input),
      temperature: 0.2,
    });

    return {
      runId: `openai-compat-run-${randomUUID()}`,
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
    readonly instructions: string;
    readonly userText: string;
  }): Promise<TPayload> {
    const raw = await this.runTextPrompt({
      ...input,
      temperature: 0.1,
    });

    try {
      return JSON.parse(extractJsonBlock(raw)) as TPayload;
    } catch (error) {
      throw new Error(`OPENAI_COMPAT JSON invalido: ${toErrorMessage(error)}`);
    }
  }

  private async runTextPrompt(input: {
    readonly modelId: string;
    readonly instructions: string;
    readonly userText: string;
    readonly temperature: number;
  }): Promise<string> {
    const response = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: input.modelId,
        temperature: input.temperature,
        messages: [
          {
            role: 'system',
            content: input.instructions,
          },
          {
            role: 'user',
            content: input.userText,
          },
        ],
      }),
    });
    const raw = await response.text();

    if (!response.ok) {
      throw new Error(`OPENAI_COMPAT chat error ${response.status}: ${extractBestErrorMessage(raw)}`);
    }

    const parsed = JSON.parse(raw) as OpenAiCompatChatCompletionsResponse;
    const text = extractAssistantMessage(parsed).trim();

    if (!text) {
      throw new Error('OPENAI_COMPAT resposta vazia.');
    }

    return text;
  }

  private async resolveModelId(): Promise<string> {
    const resolved = this.config.modelResolver ? await this.config.modelResolver() : undefined;
    const trimmed = typeof resolved === 'string' ? resolved.trim() : '';
    return trimmed || this.defaultModelId;
  }

  private buildHeaders(): Record<string, string> {
    const apiKey =
      this.config.apiKey?.trim() ||
      process.env.LUME_HUB_OPENAI_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      throw new Error('OPENAI_COMPAT api key em falta. Define LUME_HUB_OPENAI_API_KEY ou OPENAI_API_KEY.');
    }

    return {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      'user-agent': 'LumeHub',
    };
  }
}

export class LlmOpenaiCompatAdapter {
  constructor(readonly config: LlmOpenaiCompatAdapterConfig = {}) {}

  createProvider(): OpenAiCompatLlmProvider {
    return new OpenAiCompatLlmProvider(this.config);
  }

  describe(): Readonly<Record<string, unknown>> {
    return {
      adapter: 'llm-openai-compat',
      enabled: this.config.enabled ?? true,
      providerId: this.config.providerId ?? 'openai-compat',
      baseUrl: normaliseBaseUrl(
        this.config.baseUrl ??
          process.env.LUME_HUB_OPENAI_BASE_URL ??
          process.env.OPENAI_BASE_URL ??
          DEFAULT_OPENAI_COMPAT_BASE_URL,
      ),
      defaultModelId: this.config.defaultModelId ?? DEFAULT_OPENAI_COMPAT_MODEL,
    };
  }
}

function buildGeneralChatInstructions(): string {
  return [
    'Es o assistente operacional do LumeHub.',
    'Responde sempre em portugues europeu.',
    'Mantem-te claro, util e direto.',
    'Usa apenas o contexto fornecido e nao inventes factos.',
    'Se faltarem dados, assume pouco e explica o limite.',
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
    'Devolve apenas JSON valido.',
    'Formato exato: {"candidates":[{"title":"string","dateHint":"YYYY-MM-DD|null","timeHint":"HH:MM|null","confidence":"low|medium|high","notes":["string"]}],"notes":["string"]}.',
    'Nao escrevas markdown nem texto fora do JSON.',
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
    'Devolve apenas JSON valido.',
    'Formato exato: {"weekId":"string","prompts":["string"]}.',
    'Cada prompt deve ser curto, claro e operacional.',
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

function extractAssistantMessage(payload: OpenAiCompatChatCompletionsResponse): string {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('');
  }

  return '';
}

function buildModelCatalog(providerId: string, modelIds: readonly string[]): readonly LlmModelDescriptor[] {
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
        streaming: false,
      },
    }));
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

function normaliseBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/u, '');
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
