import type { AssistantContextMessageExcerpt, ConversationHistoryMessage } from '../entities/AssistantContext.js';

export class ConversationRelevanceRanker {
  rank(
    currentText: string,
    messages: readonly ConversationHistoryMessage[],
    limit = 8,
  ): readonly AssistantContextMessageExcerpt[] {
    const currentTokens = tokenize(currentText);
    const scored = messages.map((message, index) => ({
      message,
      score: relevanceScore(currentTokens, message.text, index, messages.length),
    }));

    return scored
      .sort((left, right) => right.score - left.score || right.message.createdAt.localeCompare(left.message.createdAt))
      .slice(0, Math.max(limit, 1))
      .map(({ message, score }) => ({
        ...message,
        relevanceScore: Number(score.toFixed(2)),
      }))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }
}

function relevanceScore(
  currentTokens: readonly string[],
  candidateText: string,
  index: number,
  totalMessages: number,
): number {
  const candidateTokens = tokenize(candidateText);
  const sharedTokens = currentTokens.filter((token) => candidateTokens.includes(token)).length;
  const recencyBoost = totalMessages === 0 ? 0 : (index + 1) / totalMessages;

  return sharedTokens * 3 + recencyBoost;
}

function tokenize(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9à-ÿ]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}
