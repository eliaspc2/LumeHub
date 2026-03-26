import { randomUUID } from 'node:crypto';

import type {
  LlmChatInput,
  LlmChatResult,
  LlmModelDescriptor,
  LlmProvider,
  LlmScheduleParseInput,
  LlmScheduleParseResult,
  WeeklyPromptPlan,
  WeeklyPromptPlanningInput,
} from '../../domain/entities/LlmOrchestrator.js';

const DEFAULT_PROVIDER_ID = 'local-deterministic';
const DEFAULT_MODEL_ID = 'lume-context-v1';

export class DeterministicLlmProvider implements LlmProvider {
  readonly providerId = DEFAULT_PROVIDER_ID;
  readonly defaultModelId = DEFAULT_MODEL_ID;

  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    return {
      runId: `llm-run-${randomUUID()}`,
      providerId: this.providerId,
      modelId: this.defaultModelId,
      text: buildChatReply(input),
    };
  }

  async parseSchedules(input: LlmScheduleParseInput): Promise<LlmScheduleParseResult> {
    const lowerText = input.text.toLowerCase();
    const timeMatch = input.text.match(/\b(\d{1,2}:\d{2})\b/);
    const dayMatch = /(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo|amanha|amanhã|hoje)/i.exec(input.text);
    const title = input.text
      .replace(/(?:marca|marcar|agenda|agendar|adiciona|adicionar)\s+/gi, '')
      .replace(/\s+amanh[ãa]|\s+hoje/gi, '')
      .replace(/\s+às?\s+\d{1,2}:\d{2}/gi, '')
      .trim();

    const notes = [
      input.referenceDate ? `reference_date=${input.referenceDate}` : null,
      input.timezone ? `timezone=${input.timezone}` : null,
    ].filter((value): value is string => Boolean(value));

    return {
      candidates: [
        {
          title: title || 'Evento sem titulo explicito',
          dateHint: dayMatch?.[1] ?? null,
          timeHint: timeMatch?.[1] ?? null,
          confidence: timeMatch || dayMatch ? 'medium' : 'low',
          notes: lowerText.includes('aula') ? ['mentions_aula'] : [],
        },
      ],
      notes,
    };
  }

  async planWeeklyPrompts(input: WeeklyPromptPlanningInput): Promise<WeeklyPromptPlan> {
    const prompts = (input.items ?? [])
      .slice(0, input.requestedCount ?? 3)
      .map((item) => `Preparar acompanhamento de ${item.title} (${item.groupLabel ?? 'sem grupo'}) para ${item.dueAt}.`);

    return {
      weekId: input.weekId,
      prompts: prompts.length > 0 ? prompts : [`Rever a semana ${input.weekId} e validar proximos avisos.`],
    };
  }

  listModels(): readonly LlmModelDescriptor[] {
    return [
      {
        providerId: this.providerId,
        modelId: this.defaultModelId,
        label: 'Lume Context Deterministic',
        capabilities: {
          chat: true,
          scheduling: true,
          weeklyPlanning: true,
          streaming: false,
        },
      },
    ];
  }
}

function buildChatReply(input: LlmChatInput): string {
  const primaryFact = input.domainFacts?.[0] ?? null;
  const contextLine = input.contextSummary?.[0] ?? null;
  const factBlock = input.domainFacts?.slice(0, 4).join(' | ') ?? '';

  if (input.intent === 'fanout_request') {
    return [`Fan-out analisado: ${factBlock || primaryFact || 'sem factos adicionais'}.`, contextLine]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  if (input.intent === 'local_summary_request') {
    return [
      primaryFact ? `Resumo operacional: ${primaryFact}` : null,
      contextLine ? `Contexto: ${contextLine}` : null,
      input.domainFacts && input.domainFacts.length > 1 ? `Detalhes: ${input.domainFacts.slice(1, 3).join(' | ')}` : null,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  if (input.intent === 'scheduling_request') {
    return [
      primaryFact ? `Scheduling: ${primaryFact}` : null,
      input.domainFacts && input.domainFacts.length > 1 ? `Pistas: ${input.domainFacts.slice(1, 4).join(' | ')}` : null,
      contextLine ? `Referente ativo: ${contextLine}` : null,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Consigo interpretar o pedido e cruzar com o contexto recente.';
  }

  return [
    primaryFact ? `Contexto operacional: ${primaryFact}` : null,
    contextLine ? `Contexto recente: ${contextLine}` : null,
    input.domainFacts && input.domainFacts.length > 1 ? `Notas: ${input.domainFacts.slice(1, 3).join(' | ')}` : null,
    input.text ? `Pedido atual: ${input.text.trim()}` : null,
  ]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Tenho o contexto recente pronto para responder.';
}
