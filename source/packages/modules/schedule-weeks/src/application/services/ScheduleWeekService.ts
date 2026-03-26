import { SystemClock, type Clock } from '@lume-hub/clock';

import type { ScheduleWeek, ScheduleWeekFile } from '../../domain/entities/ScheduleWeek.js';
import type { ScheduleWeekQuery, ScheduleWeekRepository } from '../../domain/repositories/ScheduleWeekRepository.js';
import { WeekCalculator } from '../../domain/services/WeekCalculator.js';

export class ScheduleWeekService {
  constructor(
    private readonly repository: ScheduleWeekRepository,
    readonly weekCalculator = new WeekCalculator(),
    private readonly clock: Clock = new SystemClock(),
  ) {}

  async getWeek(weekId: string, query: ScheduleWeekQuery = {}): Promise<ScheduleWeek | undefined> {
    const weeks = await this.repository.listWeeks(query);
    return weeks.find((week) => week.weekId === weekId);
  }

  async getCurrentWeek(query: ScheduleWeekQuery & { readonly now?: Date } = {}): Promise<ScheduleWeek> {
    const now = query.now ?? this.clock.now();
    return this.ensureWeekForDate(now, query);
  }

  async listWeeks(query: ScheduleWeekQuery = {}): Promise<readonly ScheduleWeek[]> {
    return this.repository.listWeeks(query);
  }

  async ensureWeekForDate(input: Date | string, query: ScheduleWeekQuery = {}): Promise<ScheduleWeek> {
    const timeZone = query.timeZone ?? 'Europe/Lisbon';
    const fallback = this.weekCalculator.ensureWeekForDate(input, timeZone);
    const existing = await this.getWeek(fallback.weekId, query);

    return existing ?? fallback;
  }

  async readWeekFile(weekId: string, query: ScheduleWeekQuery = {}): Promise<ScheduleWeekFile | undefined> {
    return this.repository.readWeekFile(weekId, query);
  }
}
