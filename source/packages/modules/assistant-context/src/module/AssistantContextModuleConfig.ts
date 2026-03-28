import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { GroupKnowledgeModuleContract } from '@lume-hub/group-knowledge';
import type { PeopleMemoryModuleContract } from '@lume-hub/people-memory';

import type { AssistantContextBuilder } from '../application/services/AssistantContextBuilder.js';
import type { ConversationHistoryReader } from '../application/services/ConversationHistoryReader.js';
import type { ScheduleContextProvider } from '../application/services/ScheduleContextProvider.js';
import type { ConversationHistoryRepository } from '../infrastructure/persistence/ConversationHistoryRepository.js';
import type { ActiveReferenceResolver } from '../domain/services/ActiveReferenceResolver.js';
import type { ConversationRelevanceRanker } from '../domain/services/ConversationRelevanceRanker.js';

export interface AssistantContextModuleConfig {
  readonly enabled?: boolean;
  readonly dataRootPath?: string;
  readonly historyFilePath?: string;
  readonly groupDirectory?: GroupDirectoryModuleContract;
  readonly groupKnowledge?: Pick<GroupKnowledgeModuleContract, 'retrieveRelevantSnippets'>;
  readonly peopleMemory?: Pick<
    PeopleMemoryModuleContract,
    'findPersonById' | 'listImportantNotes'
  >;
  readonly repository?: ConversationHistoryRepository;
  readonly historyReader?: ConversationHistoryReader;
  readonly relevanceRanker?: ConversationRelevanceRanker;
  readonly activeReferenceResolver?: ActiveReferenceResolver;
  readonly scheduleContextProvider?: ScheduleContextProvider;
  readonly service?: AssistantContextBuilder;
}
