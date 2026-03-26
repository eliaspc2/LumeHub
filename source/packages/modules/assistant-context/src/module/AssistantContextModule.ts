import { BaseModule } from '@lume-hub/kernel';
import { GroupDirectoryModule } from '@lume-hub/group-directory';
import { PeopleMemoryModule } from '@lume-hub/people-memory';

import { AssistantContextBuilder } from '../application/services/AssistantContextBuilder.js';
import { ConversationHistoryReader } from '../application/services/ConversationHistoryReader.js';
import { ScheduleContextProvider } from '../application/services/ScheduleContextProvider.js';
import { ActiveReferenceResolver } from '../domain/services/ActiveReferenceResolver.js';
import { ConversationRelevanceRanker } from '../domain/services/ConversationRelevanceRanker.js';
import { ConversationHistoryRepository } from '../infrastructure/persistence/ConversationHistoryRepository.js';
import type { AssistantContextModuleContract } from '../public/contracts/index.js';
import type { AssistantContextModuleConfig } from './AssistantContextModuleConfig.js';

export class AssistantContextModule extends BaseModule implements AssistantContextModuleContract {
  readonly moduleName = 'assistant-context' as const;
  readonly service: AssistantContextBuilder;

  constructor(readonly config: AssistantContextModuleConfig = {}) {
    super({
      name: 'assistant-context',
      version: '0.1.0',
      dependencies: ['group-directory', 'people-memory'],
    });

    const groupDirectory =
      config.groupDirectory ??
      new GroupDirectoryModule({
        dataRootPath: config.dataRootPath,
      });
    const peopleMemory = config.peopleMemory ?? new PeopleMemoryModule();
    const repository =
      config.repository ??
      new ConversationHistoryRepository({
        dataRootPath: config.dataRootPath,
        historyFilePath: config.historyFilePath,
      });
    const historyReader = config.historyReader ?? new ConversationHistoryReader(repository);
    const relevanceRanker = config.relevanceRanker ?? new ConversationRelevanceRanker();
    const activeReferenceResolver = config.activeReferenceResolver ?? new ActiveReferenceResolver(groupDirectory);
    const scheduleContextProvider = config.scheduleContextProvider ?? new ScheduleContextProvider();

    this.service =
      config.service ??
      new AssistantContextBuilder(
        repository,
        historyReader,
        relevanceRanker,
        activeReferenceResolver,
        peopleMemory,
        groupDirectory,
        scheduleContextProvider,
      );
  }

  async buildChatContext(input: Parameters<AssistantContextBuilder['buildChatContext']>[0]) {
    return this.service.buildChatContext(input);
  }

  async buildSchedulingContext(input: Parameters<AssistantContextBuilder['buildSchedulingContext']>[0]) {
    return this.service.buildSchedulingContext(input);
  }

  async recordMessage(input: Parameters<AssistantContextBuilder['recordMessage']>[0]) {
    return this.service.recordMessage(input);
  }

  async listChatHistory(chatJid: string, limit?: number) {
    return this.service.listChatHistory(chatJid, limit);
  }
}
