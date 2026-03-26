export class MessageHeuristics {
  looksLikeOwnerCommand(text: string): boolean {
    return /^!(term|queue|calendar)\b/i.test(text.trim());
  }

  looksLikeFanoutRequest(text: string): boolean {
    return matchesAny(text, ['fanout', 'distribui', 'reencaminha', 'envia para', 'manda para as turmas']);
  }

  looksLikeSchedulingRequest(text: string): boolean {
    return matchesAny(text, [
      'agenda',
      'aula',
      'horario',
      'marca ',
      'marcar ',
      'adiciona ',
      'altera ',
      'muda ',
      'cancela ',
      'apaga ',
      'amanha',
      'amanhã',
    ]);
  }

  looksLikeSummaryRequest(text: string): boolean {
    return matchesAny(text, ['resume', 'resumo', 'sintese', 'síntese', 'o que aconteceu']);
  }

  looksLikeOperationalInstruction(text: string): boolean {
    return matchesAny(text, ['faz ', 'verifica ', 'confirma ', 'executa ', 'analisa ']);
  }

  looksLikeCasualConversation(text: string): boolean {
    return matchesAny(text, ['ola', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem', '?']);
  }
}

function matchesAny(text: string, patterns: readonly string[]): boolean {
  const normalisedText = text.trim().toLowerCase();
  return patterns.some((pattern) => normalisedText.includes(pattern));
}
