import { AdminConfigModule } from '@lume-hub/admin-config';
import { GroupDirectoryModule } from '@lume-hub/group-directory';
import { BaseModule } from '@lume-hub/kernel';
import { PeopleMemoryModule } from '@lume-hub/people-memory';
import { ScheduleEventsModule } from '@lume-hub/schedule-events';

import { resolveCodexOrchestratorPaths } from '../application/services/CodexOrchestratorPaths.js';
import { CodexOrchestratorService } from '../application/services/CodexOrchestratorService.js';
import type { CodexOrchestratorModuleContract } from '../domain/entities/CodexOrchestrator.js';
import type { CodexOrchestratorModuleConfig } from './CodexOrchestratorModuleConfig.js';

export class CodexOrchestratorModule extends BaseModule implements CodexOrchestratorModuleContract {
  readonly moduleName = 'codex-orchestrator' as const;
  readonly service: CodexOrchestratorService;

  constructor(readonly config: CodexOrchestratorModuleConfig = {}) {
    super({
      name: 'codex-orchestrator',
      version: '0.1.0',
      dependencies: ['admin-config', 'people-memory', 'group-directory', 'schedule-events'],
    });

    const paths = resolveCodexOrchestratorPaths(config);
    const adminConfig = config.adminConfig ?? new AdminConfigModule({ settingsFilePath: paths.settingsFilePath });
    const peopleMemory = config.peopleMemory ?? new PeopleMemoryModule({ peopleFilePath: paths.peopleFilePath });
    const groupDirectory =
      config.groupDirectory ??
      new GroupDirectoryModule({
        dataRootPath: paths.dataRootPath,
        groupSeedFilePath: paths.groupSeedFilePath,
      });
    const scheduleEvents = config.scheduleEvents ?? new ScheduleEventsModule({ dataRootPath: paths.dataRootPath });

    this.service =
      config.service ??
      new CodexOrchestratorService(paths, adminConfig, peopleMemory, groupDirectory, scheduleEvents);
  }

  async status() {
    return this.service.status();
  }

  async syncAdminFromPhoneFile(phoneFilePath?: string) {
    return this.service.syncAdminFromPhoneFile(phoneFilePath);
  }

  async lockdownToAdminAndScheduledGroups() {
    return this.service.lockdownToAdminAndScheduledGroups();
  }

  async upsertGroupPrompt(input: Parameters<CodexOrchestratorService['upsertGroupPrompt']>[0]) {
    return this.service.upsertGroupPrompt(input);
  }

  async createScheduleEvent(input: Parameters<CodexOrchestratorService['createScheduleEvent']>[0]) {
    return this.service.createScheduleEvent(input);
  }

  async createAutomation(input: Parameters<CodexOrchestratorService['createAutomation']>[0]) {
    return this.service.createAutomation(input);
  }

  async createWeeklyAutomation(input: Parameters<CodexOrchestratorService['createWeeklyAutomation']>[0]) {
    return this.service.createWeeklyAutomation(input);
  }
}
