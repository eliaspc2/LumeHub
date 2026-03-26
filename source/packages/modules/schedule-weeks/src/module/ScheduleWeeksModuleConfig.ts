import type { Clock } from '@lume-hub/clock';

import type { ScheduleWeekService } from '../application/services/ScheduleWeekService.js';
import type { ScheduleWeekRepository } from '../domain/repositories/ScheduleWeekRepository.js';
import type { WeekCalculator } from '../domain/services/WeekCalculator.js';

export interface ScheduleWeeksModuleConfig {
  readonly dataRootPath?: string;
  readonly clock?: Clock;
  readonly repository?: ScheduleWeekRepository;
  readonly service?: ScheduleWeekService;
  readonly weekCalculator?: WeekCalculator;
}
