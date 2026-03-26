import { BaseModule } from '@lume-hub/kernel';
import {
  CalendarBackedNotificationRuleRepository,
  NotificationRulePolicyEngine,
  NotificationRuleService,
} from '@lume-hub/notification-rules';
import {
  CalendarBackedScheduleEventRepository,
  ScheduleEventFactory,
  ScheduleEventMutator,
  ScheduleEventService,
} from '@lume-hub/schedule-events';
import { GroupCalendarFileRepository, GroupPathResolver } from '@lume-hub/persistence-group-files';
import { WeekCalculator } from '@lume-hub/schedule-weeks';

import { NotificationJobService } from '../application/services/NotificationJobService.js';
import { NotificationJobMaterializer } from '../domain/services/NotificationJobMaterializer.js';
import { CalendarBackedNotificationJobRepository } from '../infrastructure/persistence/CalendarBackedNotificationJobRepository.js';
import type { NotificationJobsModuleContract } from '../public/contracts/index.js';
import type { NotificationJobsModuleConfig } from './NotificationJobsModuleConfig.js';

export class NotificationJobsModule extends BaseModule implements NotificationJobsModuleContract {
  readonly moduleName = 'notification-jobs' as const;
  readonly service: NotificationJobService;

  constructor(readonly config: NotificationJobsModuleConfig = {}) {
    super({
      name: 'notification-jobs',
      version: '0.2.0',
      dependencies: ['schedule-events', 'notification-rules'],
    });

    const weekCalculator = config.weekCalculator ?? new WeekCalculator();
    const scheduleEventRepository =
      config.scheduleEventRepository ??
      new CalendarBackedScheduleEventRepository(
        new GroupCalendarFileRepository(
          new GroupPathResolver({
            dataRootPath: config.dataRootPath,
          }),
        ),
        weekCalculator,
      );
    const scheduleEventService =
      config.scheduleEventService ??
      new ScheduleEventService(
        scheduleEventRepository,
        new ScheduleEventFactory(weekCalculator),
        new ScheduleEventMutator(weekCalculator),
      );
    const notificationRuleService =
      config.notificationRuleService ??
      new NotificationRuleService(
        new CalendarBackedNotificationRuleRepository(scheduleEventService),
        new NotificationRulePolicyEngine(),
        scheduleEventService,
      );
    const repository =
      config.repository ??
      new CalendarBackedNotificationJobRepository(scheduleEventService, scheduleEventRepository);
    const materializer = config.materializer ?? new NotificationJobMaterializer(weekCalculator);

    this.service =
      config.service ??
      new NotificationJobService(
        repository,
        notificationRuleService,
        scheduleEventService,
        materializer,
        config.clock,
      );
  }

  async materializeForEvent(eventId: string, query = {}) {
    return this.service.materializeForEvent(eventId, query);
  }

  async listPendingJobs(query = {}) {
    return this.service.listPendingJobs(query);
  }

  async markSuppressed(jobId: string, query = {}) {
    return this.service.markSuppressed(jobId, query);
  }

  async markDisabled(jobId: string, query = {}) {
    return this.service.markDisabled(jobId, query);
  }
}
