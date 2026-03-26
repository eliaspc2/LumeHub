import type { ScheduleEvent } from '../entities/ScheduleEvent.js';

export interface ScheduleEventQuery {
  readonly groupJid?: string;
  readonly weekId?: string;
}

export interface ScheduleEventLookupQuery {
  readonly groupJid?: string;
}

export interface ScheduleEventRepository {
  saveEvent(event: ScheduleEvent): Promise<ScheduleEvent>;
  readEvent(eventId: string, query?: ScheduleEventLookupQuery): Promise<ScheduleEvent | undefined>;
  deleteEvent(eventId: string, query?: ScheduleEventLookupQuery): Promise<boolean>;
  listEvents(query?: ScheduleEventQuery): Promise<readonly ScheduleEvent[]>;
}
