import { BaseModule } from '@lume-hub/kernel';
import { CalendarBackedNotificationJobRepository } from '@lume-hub/notification-jobs';
import { RuntimeWatchdogIssueRepository } from '@lume-hub/watchdog';
import {
  CalendarBackedScheduleEventRepository,
  ScheduleEventFactory,
  ScheduleEventMutator,
  ScheduleEventService,
} from '@lume-hub/schedule-events';
import { GroupCalendarFileRepository, GroupPathResolver } from '@lume-hub/persistence-group-files';
import { WeekCalculator } from '@lume-hub/schedule-weeks';

import { HealthCheckService } from '../application/services/HealthCheckService.js';
import { ModuleHealthAggregator } from '../domain/services/ModuleHealthAggregator.js';
import type { HealthMonitorModuleContract } from '../public/contracts/index.js';
import type { HealthMonitorModuleConfig } from './HealthMonitorModuleConfig.js';

export class HealthMonitorModule extends BaseModule implements HealthMonitorModuleContract {
  readonly moduleName = 'health-monitor' as const;
  readonly service: HealthCheckService;

  constructor(readonly config: HealthMonitorModuleConfig = {}) {
    super({
      name: 'health-monitor',
      version: '0.2.0',
      dependencies: ['notification-jobs', 'watchdog'],
    });

    const weekCalculator = new WeekCalculator();
    const calendarRepository = new GroupCalendarFileRepository(
      new GroupPathResolver({
        dataRootPath: config.dataRootPath,
      }),
    );
    const scheduleEventRepository = new CalendarBackedScheduleEventRepository(calendarRepository, weekCalculator);
    const scheduleEventService = new ScheduleEventService(
      scheduleEventRepository,
      new ScheduleEventFactory(weekCalculator),
      new ScheduleEventMutator(weekCalculator),
    );
    const notificationJobRepository =
      config.notificationJobRepository ??
      new CalendarBackedNotificationJobRepository(scheduleEventService, scheduleEventRepository);

    this.service =
      config.service ??
      new HealthCheckService(
        notificationJobRepository,
        config.watchdogIssueRepository ?? new RuntimeWatchdogIssueRepository({ dataRootPath: config.dataRootPath }),
        config.aggregator ?? new ModuleHealthAggregator(),
        config.moduleHealthProvider,
      );
  }

  async getHealthSnapshot(groupJid?: string) {
    return this.service.getHealthSnapshot(groupJid);
  }

  async getReadiness(groupJid?: string) {
    return this.service.getReadiness(groupJid);
  }
}
