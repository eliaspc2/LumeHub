export interface GroupKnowledgeIndexDocumentRecord {
  readonly documentId: string;
  readonly filePath: string;
  readonly title: string;
  readonly summary?: string | null;
  readonly aliases?: readonly string[];
  readonly tags?: readonly string[];
  readonly enabled?: boolean;
}

export interface GroupKnowledgeIndexFile {
  readonly schemaVersion: 1;
  readonly documents: readonly GroupKnowledgeIndexDocumentRecord[];
}

export interface GroupKnowledgeDocument {
  readonly groupJid: string;
  readonly documentId: string;
  readonly filePath: string;
  readonly absoluteFilePath: string;
  readonly title: string;
  readonly summary: string | null;
  readonly aliases: readonly string[];
  readonly tags: readonly string[];
  readonly enabled: boolean;
  readonly exists: boolean;
  readonly content: string | null;
}

export interface GroupKnowledgeIndexDocument {
  readonly groupJid: string;
  readonly indexFilePath: string;
  readonly exists: boolean;
  readonly documents: readonly GroupKnowledgeDocument[];
}

export interface GroupKnowledgeRetrievalInput {
  readonly groupJid: string;
  readonly query: string;
  readonly limit?: number;
}

export interface GroupKnowledgeDocumentUpsertInput {
  readonly groupJid: string;
  readonly documentId: string;
  readonly filePath: string;
  readonly title: string;
  readonly summary?: string | null;
  readonly aliases?: readonly string[];
  readonly tags?: readonly string[];
  readonly enabled?: boolean;
  readonly content: string;
}

export interface GroupKnowledgeDocumentDeleteResult {
  readonly groupJid: string;
  readonly documentId: string;
  readonly filePath: string | null;
  readonly deleted: boolean;
}

export interface GroupKnowledgeSnippet {
  readonly groupJid: string;
  readonly documentId: string;
  readonly title: string;
  readonly filePath: string;
  readonly absoluteFilePath: string;
  readonly score: number;
  readonly excerpt: string;
  readonly matchedTerms: readonly string[];
  readonly source: 'group_knowledge';
}
