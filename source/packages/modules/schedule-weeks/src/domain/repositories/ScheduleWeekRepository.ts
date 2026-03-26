import type { ScheduleWeek, ScheduleWeekFile } from '../entities/ScheduleWeek.js';

export interface ScheduleWeekQuery {
  readonly groupJid?: string;
  readonly timeZone?: string;
}

export interface ScheduleWeekRepository {
  listWeeks(query?: ScheduleWeekQuery): Promise<readonly ScheduleWeek[]>;
  readWeekFile(weekId: string, query?: ScheduleWeekQuery): Promise<ScheduleWeekFile | undefined>;
}
