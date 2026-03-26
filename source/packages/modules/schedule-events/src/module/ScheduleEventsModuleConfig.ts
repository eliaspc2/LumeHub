import type { ScheduleEventService } from '../application/services/ScheduleEventService.js';
import type { ScheduleEventRepository } from '../domain/repositories/ScheduleEventRepository.js';
import type { ScheduleEventFactory } from '../domain/services/ScheduleEventFactory.js';
import type { ScheduleEventMutator } from '../domain/services/ScheduleEventMutator.js';

export interface ScheduleEventsModuleConfig {
  readonly dataRootPath?: string;
  readonly repository?: ScheduleEventRepository;
  readonly service?: ScheduleEventService;
  readonly factory?: ScheduleEventFactory;
  readonly mutator?: ScheduleEventMutator;
}
