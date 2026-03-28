import { GroupDirectoryModule } from '@lume-hub/group-directory';
import { BaseModule } from '@lume-hub/kernel';

import { GroupKnowledgeService } from '../application/services/GroupKnowledgeService.js';
import { GroupKnowledgeRepository } from '../infrastructure/persistence/GroupKnowledgeRepository.js';
import type { GroupKnowledgeModuleContract } from '../public/contracts/index.js';
import type { GroupKnowledgeModuleConfig } from './GroupKnowledgeModuleConfig.js';

export class GroupKnowledgeModule extends BaseModule implements GroupKnowledgeModuleContract {
  readonly moduleName = 'group-knowledge' as const;
  readonly service: GroupKnowledgeService;

  constructor(readonly config: GroupKnowledgeModuleConfig = {}) {
    super({
      name: 'group-knowledge',
      version: '0.1.0',
      dependencies: ['group-directory'],
    });

    const groupDirectory =
      config.groupDirectory ??
      new GroupDirectoryModule({
        dataRootPath: config.dataRootPath,
      });

    this.service =
      config.service ??
      new GroupKnowledgeService(
        config.repository ??
          new GroupKnowledgeRepository(groupDirectory),
      );
  }

  async getIndex(groupJid: string) {
    return this.service.getIndex(groupJid);
  }

  async listDocuments(groupJid: string) {
    return this.service.listDocuments(groupJid);
  }

  async retrieveRelevantSnippets(input: Parameters<GroupKnowledgeService['retrieveRelevantSnippets']>[0]) {
    return this.service.retrieveRelevantSnippets(input);
  }
}
