import { GroupPathResolver } from '@lume-hub/persistence-group-files';
import { BaseModule } from '@lume-hub/kernel';

import { GroupDirectoryService } from '../application/services/GroupDirectoryService.js';
import { GroupRepository } from '../infrastructure/persistence/GroupRepository.js';
import type { GroupDirectoryModuleContract } from '../public/contracts/index.js';
import type { GroupDirectoryModuleConfig } from './GroupDirectoryModuleConfig.js';

export class GroupDirectoryModule extends BaseModule implements GroupDirectoryModuleContract {
  readonly moduleName = 'group-directory' as const;
  readonly service: GroupDirectoryService;

  constructor(readonly config: GroupDirectoryModuleConfig = {}) {
    super({
      name: 'group-directory',
      version: '0.1.0',
      dependencies: [],
    });

    const pathResolver =
      config.pathResolver ??
      new GroupPathResolver({
        dataRootPath: config.dataRootPath,
      });

    this.service =
      config.service ??
      new GroupDirectoryService(
        config.repository ??
          new GroupRepository({
            pathResolver,
            groupSeedFilePath: config.groupSeedFilePath,
          }),
        pathResolver,
      );
  }

  async listGroups() {
    return this.service.listGroups();
  }

  async findByJid(groupJid: string) {
    return this.service.findByJid(groupJid);
  }

  async findBySubject(subject: string) {
    return this.service.findBySubject(subject);
  }

  async findByAlias(alias: string) {
    return this.service.findByAlias(alias);
  }

  async refreshFromWhatsApp(snapshots: Parameters<GroupDirectoryService['refreshFromWhatsApp']>[0], now?: Date) {
    return this.service.refreshFromWhatsApp(snapshots, now);
  }

  async getGroupOwners(groupJid: string) {
    return this.service.getGroupOwners(groupJid);
  }

  async replaceGroupOwners(
    groupJid: string,
    owners: Parameters<GroupDirectoryService['replaceGroupOwners']>[1],
  ) {
    return this.service.replaceGroupOwners(groupJid, owners);
  }

  async getCalendarAccessPolicy(groupJid: string) {
    return this.service.getCalendarAccessPolicy(groupJid);
  }

  async updateCalendarAccessPolicy(
    groupJid: string,
    update: Parameters<GroupDirectoryService['updateCalendarAccessPolicy']>[1],
  ) {
    return this.service.updateCalendarAccessPolicy(groupJid, update);
  }

  async getGroupWorkspace(groupJid: string) {
    return this.service.getGroupWorkspace(groupJid);
  }

  async getGroupPrompt(groupJid: string) {
    return this.service.getGroupPrompt(groupJid);
  }

  async getGroupPolicy(groupJid: string) {
    return this.service.getGroupPolicy(groupJid);
  }

  async isGroupOwner(groupJid: string, personId: string) {
    return this.service.isGroupOwner(groupJid, personId);
  }
}
