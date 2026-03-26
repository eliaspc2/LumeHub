import type { WeekRange } from '../value-objects/WeekRange.js';

export interface ScheduleWeek {
  readonly weekId: string;
  readonly range: WeekRange;
  readonly groupJids: readonly string[];
  readonly eventCount: number;
}

export interface ScheduleWeekFile {
  readonly weekId: string;
  readonly groupJid?: string;
  readonly groupLabel?: string;
  readonly groupJids: readonly string[];
  readonly timeZone: string;
  readonly generatedAt: string;
  readonly eventCount: number;
  readonly events: readonly {
    readonly eventId: string;
    readonly weekId: string;
    readonly groupJid: string;
    readonly groupLabel: string;
    readonly title: string;
    readonly kind: string;
    readonly eventAt: string;
  }[];
}
