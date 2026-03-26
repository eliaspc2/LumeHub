import { BaseModule } from '@lume-hub/kernel';
import { GroupCalendarFileRepository, GroupPathResolver } from '@lume-hub/persistence-group-files';

import { ScheduleWeekService } from '../application/services/ScheduleWeekService.js';
import { WeekCalculator } from '../domain/services/WeekCalculator.js';
import { CalendarBackedScheduleWeekRepository } from '../infrastructure/persistence/CalendarBackedScheduleWeekRepository.js';
import type { ScheduleWeeksModuleContract } from '../public/contracts/index.js';
import type { ScheduleWeeksModuleConfig } from './ScheduleWeeksModuleConfig.js';

export class ScheduleWeeksModule extends BaseModule implements ScheduleWeeksModuleContract {
  readonly moduleName = 'schedule-weeks' as const;
  readonly weekCalculator: WeekCalculator;
  readonly service: ScheduleWeekService;

  constructor(readonly config: ScheduleWeeksModuleConfig = {}) {
    super({
      name: 'schedule-weeks',
      version: '0.2.0',
      dependencies: [],
    });

    this.weekCalculator = config.weekCalculator ?? new WeekCalculator();

    const repository =
      config.repository ??
      new CalendarBackedScheduleWeekRepository(
        new GroupCalendarFileRepository(
          new GroupPathResolver({
            dataRootPath: config.dataRootPath,
          }),
        ),
        this.weekCalculator,
      );

    this.service =
      config.service ??
      new ScheduleWeekService(
        repository,
        this.weekCalculator,
        config.clock,
      );
  }

  async getWeek(weekId: string, query = {}) {
    return this.service.getWeek(weekId, query);
  }

  async getCurrentWeek(query = {}) {
    return this.service.getCurrentWeek(query);
  }

  async listWeeks(query = {}) {
    return this.service.listWeeks(query);
  }

  async ensureWeekForDate(input: Date | string, query = {}) {
    return this.service.ensureWeekForDate(input, query);
  }

  async readWeekFile(weekId: string, query = {}) {
    return this.service.readWeekFile(weekId, query);
  }
}
