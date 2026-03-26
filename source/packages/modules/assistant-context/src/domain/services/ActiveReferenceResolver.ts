import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';

import type { AssistantContextReference, ConversationHistoryMessage } from '../entities/AssistantContext.js';

export interface ResolveActiveReferenceInput {
  readonly currentText: string;
  readonly recentMessages: readonly ConversationHistoryMessage[];
}

export class ActiveReferenceResolver {
  constructor(
    private readonly groupDirectory: Pick<
      GroupDirectoryModuleContract,
      'listGroups' | 'findByAlias' | 'findBySubject' | 'findByJid'
    >,
  ) {}

  async resolve(input: ResolveActiveReferenceInput): Promise<AssistantContextReference | null> {
    const explicitCurrentGroup = await this.resolveGroupReference(input.currentText);

    if (explicitCurrentGroup) {
      return explicitCurrentGroup;
    }

    if (looksLikeFollowUp(input.currentText)) {
      const normalisedCurrentText = normaliseReferenceText(input.currentText);

      for (const message of [...input.recentMessages].reverse()) {
        if (message.role === 'user' && normaliseReferenceText(message.text) === normalisedCurrentText) {
          continue;
        }

        const referencedGroup = await this.resolveGroupReference(message.text, message.messageId);

        if (referencedGroup) {
          return referencedGroup;
        }

        if (message.role === 'user') {
          return {
            kind: 'topic',
            label: message.text,
            groupJid: null,
            sourceMessageId: message.messageId,
          };
        }
      }
    }

    return null;
  }

  private async resolveGroupReference(text: string, sourceMessageId: string | null = null): Promise<AssistantContextReference | null> {
    const normalisedText = text.trim();

    if (!normalisedText) {
      return null;
    }

    const directSubject = await this.groupDirectory.findBySubject(normalisedText);

    if (directSubject) {
      return {
        kind: 'group',
        label: directSubject.preferredSubject,
        groupJid: directSubject.groupJid,
        sourceMessageId,
      };
    }

    const directAlias = await this.groupDirectory.findByAlias(normalisedText);

    if (directAlias) {
      return {
        kind: 'group',
        label: directAlias.preferredSubject,
        groupJid: directAlias.groupJid,
        sourceMessageId,
      };
    }

    const groups = await this.groupDirectory.listGroups();
    const lowerText = normalisedText.toLowerCase();
    const matchedGroup = groups
      .map((group) => ({
        group,
        score: scoreGroupMatch(group.preferredSubject, group.aliases, lowerText),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)[0]?.group;

    return matchedGroup
      ? {
          kind: 'group',
          label: matchedGroup.preferredSubject,
          groupJid: matchedGroup.groupJid,
          sourceMessageId,
        }
      : null;
  }
}

function looksLikeFollowUp(text: string): boolean {
  return /\b(e a|e o|e de hoje|essa|esse|a de hoje|a mesma|e quanto a)\b/i.test(text);
}

function normaliseReferenceText(text: string): string {
  return text.trim().toLowerCase();
}

function scoreGroupMatch(subject: string, aliases: readonly string[], lowerText: string): number {
  const candidates = [subject, ...aliases].map((value) => value.trim().toLowerCase()).filter(Boolean);
  let score = 0;

  for (const candidate of candidates) {
    if (lowerText.includes(candidate)) {
      score = Math.max(score, candidate.length);
    }
  }

  return score;
}
