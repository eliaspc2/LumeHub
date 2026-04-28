import type { IntentClassification, IntentClassificationInput } from '../entities/IntentClassification.js';
import { MessageHeuristics } from './MessageHeuristics.js';

export class RuleBasedIntentClassifier {
  constructor(private readonly heuristics = new MessageHeuristics()) {}

  classify(input: IntentClassificationInput): IntentClassification {
    const text = input.text.trim();
    const reasons: string[] = [];

    if (this.heuristics.looksLikeOwnerCommand(text)) {
      reasons.push('owner_command_prefix');
      return {
        intent: 'owner_command',
        confidence: 'high',
        reasons,
        requestedAccessMode: null,
      };
    }

    if (this.heuristics.looksLikeFanoutRequest(text)) {
      reasons.push('fanout_keywords');
      return {
        intent: 'fanout_request',
        confidence: 'high',
        reasons,
        requestedAccessMode: null,
      };
    }

    if (this.heuristics.looksLikeSchedulingRequest(text)) {
      reasons.push('scheduling_keywords');
      return {
        intent: 'scheduling_request',
        confidence: 'medium',
        reasons,
        requestedAccessMode: looksLikeCalendarWriteRequest(text) ? 'read_write' : 'read',
      };
    }

    if (this.heuristics.looksLikeSummaryRequest(text)) {
      reasons.push('summary_keywords');
      return {
        intent: 'local_summary_request',
        confidence: 'medium',
        reasons,
        requestedAccessMode: 'read',
      };
    }

    if (this.heuristics.looksLikeOperationalInstruction(text)) {
      reasons.push('operational_keywords');
      return {
        intent: 'operational_instruction',
        confidence: 'medium',
        reasons,
        requestedAccessMode: null,
      };
    }

    if (this.heuristics.looksLikeCasualConversation(text)) {
      reasons.push('casual_tone');
      return {
        intent: 'casual_chat',
        confidence: 'low',
        reasons,
        requestedAccessMode: null,
      };
    }

    return {
      intent: 'unknown',
      confidence: 'low',
      reasons: ['no_rule_matched'],
      requestedAccessMode: null,
    };
  }
}

function looksLikeCalendarWriteRequest(text: string): boolean {
  const normalisedText = text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  if (
    /\b(agendar|cria|criar|marca|marcar|adiciona|adicionar|altera|alterar|atualiza|atualizar|muda|mudar|corrige|corrigir|mete|poe|cancela|cancelar|apaga|apagar|remove|remover)\b/u.test(
      normalisedText,
    )
  ) {
    return true;
  }

  if (/\bagenda\s+(isto|este|esta|desta|ja|a aula|o evento|o agendamento)\b/u.test(normalisedText)) {
    return true;
  }

  if (/\blink\b/u.test(normalisedText) && /\b(vc|aula|agendamento|evento)\b/u.test(normalisedText)) {
    return true;
  }

  return false;
}
