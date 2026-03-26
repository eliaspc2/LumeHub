import { BaseModule } from '@lume-hub/kernel';
import { GroupCalendarFileRepository, GroupPathResolver } from '@lume-hub/persistence-group-files';
import { WeekCalculator } from '@lume-hub/schedule-weeks';

import { ScheduleEventService } from '../application/services/ScheduleEventService.js';
import { ScheduleEventFactory } from '../domain/services/ScheduleEventFactory.js';
import { ScheduleEventMutator } from '../domain/services/ScheduleEventMutator.js';
import { CalendarBackedScheduleEventRepository } from '../infrastructure/persistence/CalendarBackedScheduleEventRepository.js';
import type { ScheduleEventsModuleContract } from '../public/contracts/index.js';
import type { ScheduleEventsModuleConfig } from './ScheduleEventsModuleConfig.js';

export class ScheduleEventsModule extends BaseModule implements ScheduleEventsModuleContract {
  readonly moduleName = 'schedule-events' as const;
  readonly service: ScheduleEventService;

  constructor(readonly config: ScheduleEventsModuleConfig = {}) {
    super({
      name: 'schedule-events',
      version: '0.2.0',
      dependencies: ['schedule-weeks'],
    });

    const weekCalculator = new WeekCalculator();
    const repository =
      config.repository ??
      new CalendarBackedScheduleEventRepository(
        new GroupCalendarFileRepository(
          new GroupPathResolver({
            dataRootPath: config.dataRootPath,
          }),
        ),
        weekCalculator,
      );
    const factory = config.factory ?? new ScheduleEventFactory(weekCalculator);
    const mutator = config.mutator ?? new ScheduleEventMutator(weekCalculator);

    this.service = config.service ?? new ScheduleEventService(repository, factory, mutator);
  }

  async createEvent(input: import('../domain/entities/ScheduleEvent.js').ScheduleEventCreateInput) {
    return this.service.createEvent(input);
  }

  async updateEvent(
    eventId: string,
    changes: import('../domain/entities/ScheduleEvent.js').ScheduleEventUpdateInput,
    query = {},
  ) {
    return this.service.updateEvent(eventId, changes, query);
  }

  async deleteEvent(eventId: string, query = {}) {
    return this.service.deleteEvent(eventId, query);
  }

  async listEventsByWeek(weekId: string, query = {}) {
    return this.service.listEventsByWeek(weekId, query);
  }

  async findEventById(eventId: string, query = {}) {
    return this.service.findEventById(eventId, query);
  }
}
