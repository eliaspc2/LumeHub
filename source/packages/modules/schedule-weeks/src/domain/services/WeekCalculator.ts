import type { ScheduleWeek } from '../entities/ScheduleWeek.js';
import type { WeekRange } from '../value-objects/WeekRange.js';

export interface LocalDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

export interface CalendarMonthReference {
  readonly year: number;
  readonly month: number;
}

export interface LocalDateTimeInput {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly timeZone: string;
}

const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();
const offsetFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  dateTimeFormatterCache.set(timeZone, formatter);
  return formatter;
}

function getOffsetFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = offsetFormatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  offsetFormatterCache.set(timeZone, formatter);
  return formatter;
}

function asDate(input: Date | string): Date {
  const value = input instanceof Date ? input : new Date(input);

  if (Number.isNaN(value.getTime())) {
    throw new Error(`Invalid date input '${String(input)}'.`);
  }

  return value;
}

function isoDateFromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class WeekCalculator {
  getLocalDateParts(input: Date | string, timeZone: string): LocalDateParts {
    const formatted = getDateTimeFormatter(timeZone).formatToParts(asDate(input));
    const parts = Object.fromEntries(formatted.map((part) => [part.type, part.value]));

    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second),
    };
  }

  calendarMonthForDate(input: Date | string, timeZone: string): CalendarMonthReference {
    const localDate = this.getLocalDateParts(input, timeZone);
    return {
      year: localDate.year,
      month: localDate.month,
    };
  }

  weekIdForDate(input: Date | string, timeZone: string): string {
    const localDate = this.getLocalDateParts(input, timeZone);
    const utcAnchor = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day, 12));
    const weekday = utcAnchor.getUTCDay() || 7;
    utcAnchor.setUTCDate(utcAnchor.getUTCDate() + 4 - weekday);
    const weekYear = utcAnchor.getUTCFullYear();
    const yearStart = new Date(Date.UTC(weekYear, 0, 1, 12));
    const weekNumber = Math.ceil((((utcAnchor.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);

    return `${weekYear}-W${String(weekNumber).padStart(2, '0')}`;
  }

  weekRange(weekId: string, timeZone: string): WeekRange {
    const match = /^(\d{4})-W(\d{2})$/u.exec(weekId);

    if (!match) {
      throw new Error(`Invalid ISO week id '${weekId}'.`);
    }

    const year = Number(match[1]);
    const week = Number(match[2]);
    const januaryFourth = new Date(Date.UTC(year, 0, 4, 12));
    const januaryFourthWeekday = januaryFourth.getUTCDay() || 7;
    const monday = new Date(januaryFourth);
    monday.setUTCDate(januaryFourth.getUTCDate() - januaryFourthWeekday + 1 + ((week - 1) * 7));

    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    return {
      startDate: isoDateFromUtc(monday),
      endDate: isoDateFromUtc(sunday),
      timeZone,
    };
  }

  ensureWeekForDate(input: Date | string, timeZone: string): ScheduleWeek {
    const weekId = this.weekIdForDate(input, timeZone);

    return {
      weekId,
      range: this.weekRange(weekId, timeZone),
      groupJids: [],
      eventCount: 0,
    };
  }

  shiftLocalDate(parts: Pick<LocalDateParts, 'year' | 'month' | 'day'>, daysDelta: number): Pick<LocalDateParts, 'year' | 'month' | 'day'> {
    const anchor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
    anchor.setUTCDate(anchor.getUTCDate() + daysDelta);

    return {
      year: anchor.getUTCFullYear(),
      month: anchor.getUTCMonth() + 1,
      day: anchor.getUTCDate(),
    };
  }

  localDateTimeToInstant(input: LocalDateTimeInput): Date {
    const parseOffset = (value: string): number => {
      const match = /^GMT(?:(?<sign>[+-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?)?$/u.exec(value);

      if (!match?.groups?.sign) {
        return 0;
      }

      const sign = match.groups.sign === '-' ? -1 : 1;
      const hours = Number(match.groups.hours ?? '0');
      const minutes = Number(match.groups.minutes ?? '0');

      return sign * ((hours * 60) + minutes);
    };

    const toTimestamp = () =>
      Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, 0, 0);

    let guess = toTimestamp();

    for (let iteration = 0; iteration < 4; iteration += 1) {
      const parts = getOffsetFormatter(input.timeZone).formatToParts(new Date(guess));
      const offsetToken = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
      const offsetMinutes = parseOffset(offsetToken);
      const candidate = toTimestamp() - (offsetMinutes * 60_000);

      if (candidate === guess) {
        break;
      }

      guess = candidate;
    }

    return new Date(guess);
  }
}
