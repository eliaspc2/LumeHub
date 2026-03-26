export type {
  EventKind,
  EventTarget,
  ScheduleEvent,
  ScheduleEventCreateInput,
  ScheduleEventUpdateInput,
} from '../../domain/entities/ScheduleEvent.js';
export type {
  ScheduleEventLookupQuery,
  ScheduleEventQuery,
} from '../../domain/repositories/ScheduleEventRepository.js';

export interface ScheduleEventsModuleContract {
  readonly moduleName: 'schedule-events';
  createEvent(
    input: import('../../domain/entities/ScheduleEvent.js').ScheduleEventCreateInput,
  ): Promise<import('../../domain/entities/ScheduleEvent.js').ScheduleEvent>;
  updateEvent(
    eventId: string,
    changes: import('../../domain/entities/ScheduleEvent.js').ScheduleEventUpdateInput,
    query?: import('../../domain/repositories/ScheduleEventRepository.js').ScheduleEventLookupQuery,
  ): Promise<import('../../domain/entities/ScheduleEvent.js').ScheduleEvent>;
  deleteEvent(
    eventId: string,
    query?: import('../../domain/repositories/ScheduleEventRepository.js').ScheduleEventLookupQuery,
  ): Promise<boolean>;
  listEventsByWeek(
    weekId: string,
    query?: import('../../domain/repositories/ScheduleEventRepository.js').ScheduleEventLookupQuery,
  ): Promise<readonly import('../../domain/entities/ScheduleEvent.js').ScheduleEvent[]>;
  findEventById(
    eventId: string,
    query?: import('../../domain/repositories/ScheduleEventRepository.js').ScheduleEventLookupQuery,
  ): Promise<import('../../domain/entities/ScheduleEvent.js').ScheduleEvent | undefined>;
}
