export type { DispatchJobResult, DispatchTickResult } from '../../domain/entities/DispatchTickResult.js';
export type { ScheduleDispatcherTickInput } from '../../application/services/ScheduleDispatcherService.js';

export interface ScheduleDispatcherModuleContract {
  readonly moduleName: 'schedule-dispatcher';
  tick(
    input?: import('../../application/services/ScheduleDispatcherService.js').ScheduleDispatcherTickInput,
  ): Promise<import('../../domain/entities/DispatchTickResult.js').DispatchTickResult>;
}
