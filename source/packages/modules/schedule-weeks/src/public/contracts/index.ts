export type { ScheduleWeek, ScheduleWeekFile } from '../../domain/entities/ScheduleWeek.js';
export type { ScheduleWeekQuery } from '../../domain/repositories/ScheduleWeekRepository.js';
export type { CalendarMonthReference, LocalDateParts, LocalDateTimeInput } from '../../domain/services/WeekCalculator.js';
export type { WeekRange } from '../../domain/value-objects/WeekRange.js';

export interface ScheduleWeeksModuleContract {
  readonly moduleName: 'schedule-weeks';
  getWeek(weekId: string, query?: { readonly groupJid?: string; readonly timeZone?: string }): Promise<import('../../domain/entities/ScheduleWeek.js').ScheduleWeek | undefined>;
  getCurrentWeek(query?: {
    readonly groupJid?: string;
    readonly timeZone?: string;
    readonly now?: Date;
  }): Promise<import('../../domain/entities/ScheduleWeek.js').ScheduleWeek>;
  listWeeks(query?: { readonly groupJid?: string; readonly timeZone?: string }): Promise<readonly import('../../domain/entities/ScheduleWeek.js').ScheduleWeek[]>;
  ensureWeekForDate(input: Date | string, query?: {
    readonly groupJid?: string;
    readonly timeZone?: string;
  }): Promise<import('../../domain/entities/ScheduleWeek.js').ScheduleWeek>;
  readWeekFile(weekId: string, query?: {
    readonly groupJid?: string;
    readonly timeZone?: string;
  }): Promise<import('../../domain/entities/ScheduleWeek.js').ScheduleWeekFile | undefined>;
}
