export interface GroupKnowledgeModuleContract {
  readonly moduleName: 'group-knowledge';

  getIndex(
    groupJid: string,
  ): Promise<import('../../domain/entities/GroupKnowledge.js').GroupKnowledgeIndexDocument>;
  listDocuments(
    groupJid: string,
  ): Promise<readonly import('../../domain/entities/GroupKnowledge.js').GroupKnowledgeDocument[]>;
  retrieveRelevantSnippets(
    input: import('../../domain/entities/GroupKnowledge.js').GroupKnowledgeRetrievalInput,
  ): Promise<readonly import('../../domain/entities/GroupKnowledge.js').GroupKnowledgeSnippet[]>;
}
