import { BaseModule } from '@lume-hub/kernel';
import { AdminConfigModule } from '@lume-hub/admin-config';
import { GroupDirectoryModule } from '@lume-hub/group-directory';
import { NotificationJobsModule } from '@lume-hub/notification-jobs';
import { NotificationRulesModule } from '@lume-hub/notification-rules';
import { ScheduleEventsModule } from '@lume-hub/schedule-events';
import { ScheduleWeeksModule } from '@lume-hub/schedule-weeks';

import { WaNotifyScheduleImportService } from '../application/services/WaNotifyScheduleImportService.js';
import { WeeklyPlannerService } from '../application/services/WeeklyPlannerService.js';
import type { WeeklyPlannerModuleContract } from '../public/contracts/index.js';
import type { WeeklyPlannerQuery, WeeklyPlannerSnapshot, WeeklyPlannerUpsertInput } from '../domain/entities/WeeklyPlanner.js';
import type { WeeklyPlannerModuleConfig } from './WeeklyPlannerModuleConfig.js';

export class WeeklyPlannerModule extends BaseModule implements WeeklyPlannerModuleContract {
  readonly moduleName = 'weekly-planner' as const;
  readonly service: WeeklyPlannerService;
  readonly importService: WaNotifyScheduleImportService;

  constructor(readonly config: WeeklyPlannerModuleConfig = {}) {
    super({
      name: 'weekly-planner',
      version: '0.2.0',
      dependencies: ['admin-config', 'group-directory', 'schedule-events', 'schedule-weeks'],
    });

    const adminConfig = config.adminConfig ?? new AdminConfigModule();
    const groupDirectory =
      config.groupDirectory ??
      new GroupDirectoryModule({
        dataRootPath: config.dataRootPath,
      });
    const notificationJobs =
      config.notificationJobs ??
      new NotificationJobsModule({
        dataRootPath: config.dataRootPath,
      });
    const notificationRules =
      config.notificationRules ??
      new NotificationRulesModule({
        dataRootPath: config.dataRootPath,
      });
    const scheduleEvents =
      config.scheduleEvents ??
      new ScheduleEventsModule({
        dataRootPath: config.dataRootPath,
      });
    const scheduleWeeks =
      config.scheduleWeeks ??
      new ScheduleWeeksModule({
        dataRootPath: config.dataRootPath,
      });

    this.service =
      config.service ??
      new WeeklyPlannerService({
        adminConfig,
        groupDirectory,
        notificationJobs,
        notificationRules,
        scheduleEvents,
        scheduleWeeks,
        defaultTimeZone: config.defaultTimeZone,
        weekCalculator: config.weekCalculator,
      });
    this.importService =
      config.importService ??
      new WaNotifyScheduleImportService({
        groupDirectory,
        notificationJobs,
        notificationRules,
        scheduleEvents,
        defaultTimeZone: config.defaultTimeZone,
        weekCalculator: config.weekCalculator,
        legacyScheduleRootPath: config.legacyScheduleRootPath,
      });
  }

  async getWeekSnapshot(query: WeeklyPlannerQuery = {}): Promise<WeeklyPlannerSnapshot> {
    return this.service.getWeekSnapshot(query);
  }

  async saveSchedule(input: WeeklyPlannerUpsertInput) {
    return this.service.saveSchedule(input);
  }

  async deleteSchedule(eventId: string, query = {}) {
    return this.service.deleteSchedule(eventId, query);
  }

  async listLegacyScheduleFiles() {
    return this.importService.listLegacyScheduleFiles();
  }

  async previewLegacyScheduleImport(input: import('../public/contracts/index.js').LegacyScheduleImportInput) {
    return this.importService.previewImport(input);
  }

  async applyLegacyScheduleImport(input: import('../public/contracts/index.js').LegacyScheduleImportInput) {
    return this.importService.applyImport(input);
  }
}
