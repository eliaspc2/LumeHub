import type {
  ScheduleEvent,
  ScheduleEventCreateInput,
  ScheduleEventUpdateInput,
} from '../../domain/entities/ScheduleEvent.js';
import type {
  ScheduleEventLookupQuery,
  ScheduleEventQuery,
  ScheduleEventRepository,
} from '../../domain/repositories/ScheduleEventRepository.js';
import { ScheduleEventFactory } from '../../domain/services/ScheduleEventFactory.js';
import { ScheduleEventMutator } from '../../domain/services/ScheduleEventMutator.js';

export class ScheduleEventService {
  constructor(
    private readonly repository: ScheduleEventRepository,
    private readonly factory = new ScheduleEventFactory(),
    private readonly mutator = new ScheduleEventMutator(),
  ) {}

  async createEvent(input: ScheduleEventCreateInput): Promise<ScheduleEvent> {
    return this.repository.saveEvent(this.factory.create(input));
  }

  async updateEvent(
    eventId: string,
    changes: ScheduleEventUpdateInput,
    query: ScheduleEventLookupQuery = {},
  ): Promise<ScheduleEvent> {
    const current = await this.repository.readEvent(eventId, query);

    if (!current) {
      throw new Error(`Event '${eventId}' was not found.`);
    }

    return this.repository.saveEvent(this.mutator.apply(current, changes));
  }

  async deleteEvent(eventId: string, query: ScheduleEventLookupQuery = {}): Promise<boolean> {
    return this.repository.deleteEvent(eventId, query);
  }

  async listEventsByWeek(weekId: string, query: ScheduleEventLookupQuery = {}): Promise<readonly ScheduleEvent[]> {
    return this.repository.listEvents({
      ...query,
      weekId,
    });
  }

  async findEventById(eventId: string, query: ScheduleEventLookupQuery = {}): Promise<ScheduleEvent | undefined> {
    return this.repository.readEvent(eventId, query);
  }

  async listEvents(query: ScheduleEventQuery = {}): Promise<readonly ScheduleEvent[]> {
    return this.repository.listEvents(query);
  }
}
