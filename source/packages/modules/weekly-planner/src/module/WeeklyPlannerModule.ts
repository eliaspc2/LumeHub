import { BaseModule } from '@lume-hub/kernel';
import { AdminConfigModule } from '@lume-hub/admin-config';
import { GroupDirectoryModule } from '@lume-hub/group-directory';
import { NotificationJobsModule } from '@lume-hub/notification-jobs';
import { NotificationRulesModule } from '@lume-hub/notification-rules';
import { ScheduleEventsModule } from '@lume-hub/schedule-events';
import { ScheduleWeeksModule } from '@lume-hub/schedule-weeks';

import { WeeklyPlannerService } from '../application/services/WeeklyPlannerService.js';
import type { WeeklyPlannerModuleContract } from '../public/contracts/index.js';
import type { WeeklyPlannerModuleConfig } from './WeeklyPlannerModuleConfig.js';

export class WeeklyPlannerModule extends BaseModule implements WeeklyPlannerModuleContract {
  readonly moduleName = 'weekly-planner' as const;
  readonly service: WeeklyPlannerService;

  constructor(readonly config: WeeklyPlannerModuleConfig = {}) {
    super({
      name: 'weekly-planner',
      version: '0.2.0',
      dependencies: ['admin-config', 'group-directory', 'schedule-events', 'schedule-weeks'],
    });

    this.service =
      config.service ??
      new WeeklyPlannerService({
        adminConfig: config.adminConfig ?? new AdminConfigModule(),
        groupDirectory:
          config.groupDirectory ??
          new GroupDirectoryModule({
            dataRootPath: config.dataRootPath,
          }),
        notificationJobs:
          config.notificationJobs ??
          new NotificationJobsModule({
            dataRootPath: config.dataRootPath,
          }),
        notificationRules:
          config.notificationRules ??
          new NotificationRulesModule({
            dataRootPath: config.dataRootPath,
          }),
        scheduleEvents:
          config.scheduleEvents ??
          new ScheduleEventsModule({
            dataRootPath: config.dataRootPath,
          }),
        scheduleWeeks:
          config.scheduleWeeks ??
          new ScheduleWeeksModule({
            dataRootPath: config.dataRootPath,
          }),
        defaultTimeZone: config.defaultTimeZone,
        weekCalculator: config.weekCalculator,
      });
  }

  async getWeekSnapshot(query = {}) {
    return this.service.getWeekSnapshot(query);
  }

  async saveSchedule(input: import('../public/contracts/index.js').WeeklyPlannerUpsertInput) {
    return this.service.saveSchedule(input);
  }

  async deleteSchedule(eventId: string, query = {}) {
    return this.service.deleteSchedule(eventId, query);
  }
}
