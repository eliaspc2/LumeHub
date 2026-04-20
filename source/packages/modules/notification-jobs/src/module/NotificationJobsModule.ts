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
import {
  GroupCalendarArchiveRepository,
  GroupCalendarFileRepository,
  GroupPathResolver,
} from '@lume-hub/persistence-group-files';
import { WeekCalculator } from '@lume-hub/schedule-weeks';

import { NotificationJobCleanupService } from '../application/services/NotificationJobCleanupService.js';
import { NotificationJobService } from '../application/services/NotificationJobService.js';
import { NotificationJobMaterializer } from '../domain/services/NotificationJobMaterializer.js';
import { PastEventCleanupPolicy } from '../domain/services/PastEventCleanupPolicy.js';
import { CalendarBackedNotificationJobRepository } from '../infrastructure/persistence/CalendarBackedNotificationJobRepository.js';
import type { NotificationJobsModuleContract } from '../public/contracts/index.js';
import type { NotificationJobsModuleConfig } from './NotificationJobsModuleConfig.js';

export class NotificationJobsModule extends BaseModule implements NotificationJobsModuleContract {
  readonly moduleName = 'notification-jobs' as const;
  readonly service: NotificationJobService;
  readonly cleanupService: NotificationJobCleanupService;

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
    const pathResolver = new GroupPathResolver({
      dataRootPath: config.dataRootPath,
    });
    const cleanupService =
      config.cleanupService ??
      new NotificationJobCleanupService(
        new GroupCalendarFileRepository(pathResolver),
        new GroupCalendarArchiveRepository(pathResolver),
        config.cleanupPolicy ?? new PastEventCleanupPolicy(),
        config.clock,
      );

    this.cleanupService = cleanupService;

    this.service =
      config.service ??
      new NotificationJobService(
        repository,
        notificationRuleService,
        scheduleEventService,
        materializer,
        config.clock,
        cleanupService,
      );
  }

  async materializeForEvent(eventId: string, query = {}) {
    return this.service.materializeForEvent(eventId, query);
  }

  async listPendingJobs(query = {}) {
    return this.service.listPendingJobs(query);
  }

  async listJobs(query = {}) {
    return this.service.listJobs(query);
  }

  async markPrepared(jobId: string, input = {}, query = {}) {
    return this.service.markPrepared(jobId, input, query);
  }

  async markSuppressed(jobId: string, query = {}) {
    return this.service.markSuppressed(jobId, query);
  }

  async markDisabled(jobId: string, query = {}) {
    return this.service.markDisabled(jobId, query);
  }

  async cleanupPastEvents(input = {}) {
    return this.service.cleanupPastEvents(input);
  }
}
