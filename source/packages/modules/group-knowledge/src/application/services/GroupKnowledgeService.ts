import type {
  GroupKnowledgeDocument,
  GroupKnowledgeIndexDocument,
  GroupKnowledgeRetrievalInput,
  GroupKnowledgeSnippet,
} from '../../domain/entities/GroupKnowledge.js';
import { GroupKnowledgeRepository } from '../../infrastructure/persistence/GroupKnowledgeRepository.js';

const DEFAULT_SNIPPET_LIMIT = 3;
const MAX_EXCERPT_LENGTH = 240;

export class GroupKnowledgeService {
  constructor(private readonly repository: GroupKnowledgeRepository) {}

  async getIndex(groupJid: string): Promise<GroupKnowledgeIndexDocument> {
    return this.repository.readIndex(groupJid);
  }

  async listDocuments(groupJid: string): Promise<readonly GroupKnowledgeDocument[]> {
    return (await this.repository.readIndex(groupJid)).documents;
  }

  async retrieveRelevantSnippets(input: GroupKnowledgeRetrievalInput): Promise<readonly GroupKnowledgeSnippet[]> {
    const documents = await this.listDocuments(input.groupJid);
    const queryTokens = tokenize(input.query);
    const normalisedQuery = normaliseText(input.query);

    if (normalisedQuery.length === 0 || queryTokens.length === 0) {
      return [];
    }

    return documents
      .filter((document) => document.enabled && document.exists && document.content)
      .map((document) => buildSnippet(document, normalisedQuery, queryTokens))
      .filter((snippet): snippet is GroupKnowledgeSnippet => snippet !== null)
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
      .slice(0, Math.max(1, input.limit ?? DEFAULT_SNIPPET_LIMIT));
  }
}

function buildSnippet(
  document: GroupKnowledgeDocument,
  normalisedQuery: string,
  queryTokens: readonly string[],
): GroupKnowledgeSnippet | null {
  const titleText = normaliseText(document.title);
  const summaryText = normaliseText(document.summary ?? '');
  const aliasesText = document.aliases.map((value) => normaliseText(value));
  const tagsText = document.tags.map((value) => normaliseText(value));
  const contentText = normaliseText(document.content ?? '');
  const matchedTerms = queryTokens.filter(
    (token) =>
      titleText.includes(token) ||
      summaryText.includes(token) ||
      aliasesText.some((candidate) => candidate.includes(token)) ||
      tagsText.some((candidate) => candidate.includes(token)) ||
      contentText.includes(token),
  );

  if (matchedTerms.length === 0 && !contentText.includes(normalisedQuery)) {
    return null;
  }

  let score = matchedTerms.length * 6;

  if (titleText.includes(normalisedQuery)) {
    score += 20;
  }

  if (summaryText.includes(normalisedQuery)) {
    score += 16;
  }

  if (aliasesText.some((candidate) => candidate.includes(normalisedQuery))) {
    score += 18;
  }

  if (tagsText.some((candidate) => candidate.includes(normalisedQuery))) {
    score += 12;
  }

  if (contentText.includes(normalisedQuery)) {
    score += 10;
  }

  score += matchedTerms.filter((token) => titleText.includes(token)).length * 4;
  score += matchedTerms.filter((token) => summaryText.includes(token)).length * 3;
  score += matchedTerms.filter((token) => aliasesText.some((candidate) => candidate.includes(token))).length * 3;
  score += matchedTerms.filter((token) => tagsText.some((candidate) => candidate.includes(token))).length * 2;

  return {
    groupJid: document.groupJid,
    documentId: document.documentId,
    title: document.title,
    filePath: document.filePath,
    absoluteFilePath: document.absoluteFilePath,
    score,
    excerpt: selectExcerpt(document, normalisedQuery, queryTokens),
    matchedTerms,
    source: 'group_knowledge',
  };
}

function selectExcerpt(
  document: GroupKnowledgeDocument,
  normalisedQuery: string,
  queryTokens: readonly string[],
): string {
  const fallback = collapseWhitespace(document.summary ?? document.content ?? document.title);
  const paragraphs = extractParagraphs(document.content ?? '');

  let bestParagraph = fallback;
  let bestScore = -1;

  for (const paragraph of paragraphs) {
    const normalisedParagraph = normaliseText(paragraph);
    let paragraphScore = queryTokens.filter((token) => normalisedParagraph.includes(token)).length;

    if (normalisedParagraph.includes(normalisedQuery)) {
      paragraphScore += 3;
    }

    if (paragraphScore > bestScore) {
      bestScore = paragraphScore;
      bestParagraph = paragraph;
    }
  }

  return shortenExcerpt(bestParagraph);
}

function extractParagraphs(content: string): readonly string[] {
  return content
    .split(/\n\s*\n/gu)
    .map((paragraph) => collapseWhitespace(stripMarkdown(paragraph)))
    .filter((paragraph) => paragraph.length > 0);
}

function stripMarkdown(value: string): string {
  return value
    .replace(/^#{1,6}\s+/gmu, '')
    .replace(/^[-*+]\s+/gmu, '')
    .replace(/^>\s+/gmu, '')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
    .replace(/[*_~]/gu, '');
}

function shortenExcerpt(value: string): string {
  const collapsed = collapseWhitespace(value);

  if (collapsed.length <= MAX_EXCERPT_LENGTH) {
    return collapsed;
  }

  return `${collapsed.slice(0, MAX_EXCERPT_LENGTH - 3).trimEnd()}...`;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function tokenize(value: string): readonly string[] {
  return Array.from(new Set(normaliseText(value).match(/[a-z0-9]+/g) ?? []));
}

function normaliseText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
