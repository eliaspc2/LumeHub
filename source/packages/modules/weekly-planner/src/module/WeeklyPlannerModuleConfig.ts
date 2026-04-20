import type { AdminConfigModuleContract } from '@lume-hub/admin-config';
import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { NotificationJobsModuleContract } from '@lume-hub/notification-jobs';
import type { NotificationRulesModuleContract } from '@lume-hub/notification-rules';
import type { ScheduleEventsModuleContract } from '@lume-hub/schedule-events';
import type { ScheduleWeeksModuleContract, WeekCalculator } from '@lume-hub/schedule-weeks';

import type { WaNotifyScheduleImportService } from '../application/services/WaNotifyScheduleImportService.js';
import type { WeeklyPlannerService } from '../application/services/WeeklyPlannerService.js';

export interface WeeklyPlannerModuleConfig {
  readonly enabled?: boolean;
  readonly dataRootPath?: string;
  readonly defaultTimeZone?: string;
  readonly legacyScheduleRootPath?: string;
  readonly adminConfig?: Pick<AdminConfigModuleContract, 'getSettings'>;
  readonly groupDirectory?: Pick<GroupDirectoryModuleContract, 'listGroups' | 'getGroupPolicy'>;
  readonly notificationJobs?: Pick<NotificationJobsModuleContract, 'materializeForEvent'>;
  readonly notificationRules?: Pick<NotificationRulesModuleContract, 'replaceRulesForEvent'>;
  readonly scheduleEvents?: Pick<
    ScheduleEventsModuleContract,
    'createEvent' | 'updateEvent' | 'deleteEvent' | 'listEventsByWeek' | 'findEventById'
  >;
  readonly scheduleWeeks?: Pick<ScheduleWeeksModuleContract, 'getCurrentWeek'>;
  readonly weekCalculator?: WeekCalculator;
  readonly service?: WeeklyPlannerService;
  readonly importService?: WaNotifyScheduleImportService;
}
