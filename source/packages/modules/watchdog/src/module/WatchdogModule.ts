import { BaseModule } from '@lume-hub/kernel';
import { CalendarBackedNotificationJobRepository } from '@lume-hub/notification-jobs';
import {
  CalendarBackedScheduleEventRepository,
  ScheduleEventFactory,
  ScheduleEventMutator,
  ScheduleEventService,
} from '@lume-hub/schedule-events';
import { GroupCalendarFileRepository, GroupPathResolver } from '@lume-hub/persistence-group-files';
import { WeekCalculator } from '@lume-hub/schedule-weeks';

import { WatchdogService } from '../application/services/WatchdogService.js';
import { IssueCollector } from '../domain/services/IssueCollector.js';
import { NoopIssueNotifier } from '../domain/services/IssueNotifier.js';
import { RuntimeWatchdogIssueRepository } from '../infrastructure/persistence/RuntimeWatchdogIssueRepository.js';
import type { WatchdogModuleContract } from '../public/contracts/index.js';
import type { WatchdogModuleConfig } from './WatchdogModuleConfig.js';

export class WatchdogModule extends BaseModule implements WatchdogModuleContract {
  readonly moduleName = 'watchdog' as const;
  readonly service: WatchdogService;

  constructor(readonly config: WatchdogModuleConfig = {}) {
    super({
      name: 'watchdog',
      version: '0.2.0',
      dependencies: ['notification-jobs'],
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
      new WatchdogService(
        notificationJobRepository,
        config.repository ?? new RuntimeWatchdogIssueRepository({ dataRootPath: config.dataRootPath }),
        config.collector ?? new IssueCollector(),
        config.notifier ?? new NoopIssueNotifier(),
        config.clock,
        {
          overdueGraceMinutes: config.overdueGraceMinutes ?? 5,
          waitingConfirmationGraceMinutes: config.waitingConfirmationGraceMinutes ?? 15,
        },
      );
  }

  async tick(input = {}) {
    return this.service.tick(input);
  }

  async listIssues(query = {}) {
    return this.service.listIssues(query);
  }

  async resolveIssue(issueId: string) {
    return this.service.resolveIssue(issueId);
  }
}
