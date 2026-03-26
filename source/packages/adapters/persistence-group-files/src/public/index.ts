import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';

export const SETTINGS_SCHEMA_VERSION = 1;
export const CALENDAR_SCHEMA_VERSION = 1;
export const DEFAULT_TIMEZONE = 'Europe/Lisbon';

const weekIdSchema = z.string().regex(/^\d{4}-W\d{2}$/);

function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const timeZoneSchema = z.string().trim().min(1).refine(isValidTimeZone, {
  message: 'Invalid IANA timezone.',
});

const isoDateTimeStringSchema = z.string().datetime({ offset: true });

const notificationSchema = z.object({
  jobId: z.string().trim().min(1),
  weekId: weekIdSchema,
  ruleType: z.union([z.literal('relative_offset'), z.literal('fixed_local_time'), z.string().trim().min(1)]),
  sendAt: isoDateTimeStringSchema,
  status: z.enum(['pending', 'waiting_confirmation', 'sent']),
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  lastOutboundObservationAt: isoDateTimeStringSchema.nullable(),
  confirmedAt: isoDateTimeStringSchema.nullable(),
});

const eventSchema = z.object({
  eventId: z.string().trim().min(1),
  weekId: weekIdSchema,
  groupJid: z.string().trim().min(1),
  groupLabel: z.string().trim().min(1),
  eventAt: isoDateTimeStringSchema,
  notifications: z.array(notificationSchema),
});

const calendarMonthSchema = z
  .object({
    schemaVersion: z.literal(CALENDAR_SCHEMA_VERSION),
    groupJid: z.string().trim().min(1),
    groupLabel: z.string().trim().min(1),
    year: z.number().int().min(2000).max(9999),
    month: z.number().int().min(1).max(12),
    timezone: timeZoneSchema,
    events: z.array(eventSchema),
  })
  .superRefine((value, context) => {
    for (const [eventIndex, event] of value.events.entries()) {
      if (event.groupJid !== value.groupJid) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['events', eventIndex, 'groupJid'],
          message: 'event.groupJid must match the parent calendar groupJid.',
        });
      }

      if (event.groupLabel !== value.groupLabel) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['events', eventIndex, 'groupLabel'],
          message: 'event.groupLabel must match the parent calendar groupLabel.',
        });
      }
    }
  });

const workspaceSettingsSchema = z.object({
  schemaVersion: z.literal(SETTINGS_SCHEMA_VERSION),
  timezone: timeZoneSchema,
  calendarSchemaVersion: z.literal(CALENDAR_SCHEMA_VERSION),
  updatedAt: isoDateTimeStringSchema,
});

export type GroupNotificationRecord = z.infer<typeof notificationSchema>;
export type GroupCalendarEventRecord = z.infer<typeof eventSchema>;
export type GroupCalendarMonthFile = z.infer<typeof calendarMonthSchema>;
export type GroupWorkspaceSettingsFile = z.infer<typeof workspaceSettingsSchema>;

export interface GroupWeekViewFile {
  readonly schemaVersion: 1;
  readonly groupJid: string;
  readonly groupLabel: string;
  readonly weekId: string;
  readonly timezone: string;
  readonly generatedAt: string;
  readonly events: readonly GroupCalendarEventRecord[];
}

export interface GroupPathResolverOptions {
  readonly dataRootPath?: string;
}

export interface GroupCalendarIdentity {
  readonly groupJid: string;
  readonly year: number;
  readonly month: number;
}

export interface GroupCalendarCreationInput extends GroupCalendarIdentity {
  readonly groupLabel: string;
  readonly timezone?: string;
}

export interface GroupFileLockOptions {
  readonly timeoutMs?: number;
  readonly retryDelayMs?: number;
  readonly staleMs?: number;
}

export class GroupPathResolver {
  readonly dataRootPath: string;

  constructor(options: GroupPathResolverOptions = {}) {
    this.dataRootPath = options.dataRootPath ?? 'data';
  }

  resolveGroupsRootPath(): string {
    return join(this.dataRootPath, 'groups');
  }

  resolveWorkspaceSettingsPath(): string {
    return join(this.resolveGroupsRootPath(), '_settings.json');
  }

  resolveGroupRootPath(groupJid: string): string {
    return join(this.resolveGroupsRootPath(), groupJid);
  }

  resolveGroupCalendarDirectoryPath(groupJid: string): string {
    return join(this.resolveGroupRootPath(groupJid), 'calendar');
  }

  resolveGroupCalendarPath(groupJid: string, year: number, month: number): string {
    return join(this.resolveGroupCalendarDirectoryPath(groupJid), `${year}-${String(month).padStart(2, '0')}.json`);
  }

  resolveGroupMetadataPath(groupJid: string): string {
    return join(this.resolveGroupRootPath(groupJid), 'group.json');
  }

  resolveGroupPromptPath(groupJid: string): string {
    return join(this.resolveGroupRootPath(groupJid), 'prompt.md');
  }

  resolveGroupPolicyPath(groupJid: string): string {
    return join(this.resolveGroupRootPath(groupJid), 'policy.json');
  }

  resolveGroupViewPath(groupJid: string, weekId: string): string {
    const [year, isoWeek] = weekId.split('-W');
    return join(this.resolveGroupRootPath(groupJid), 'views', `w${Number(isoWeek)}y${year}.view.json`);
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export class GroupFileLockManager {
  constructor(
    private readonly defaults: Required<GroupFileLockOptions> = {
      timeoutMs: 5_000,
      retryDelayMs: 50,
      staleMs: 30_000,
    },
  ) {}

  lockPathFor(targetPath: string): string {
    return `${targetPath}.lock`;
  }

  async withLock<TValue>(
    targetPath: string,
    operation: () => Promise<TValue>,
    options: GroupFileLockOptions = {},
  ): Promise<TValue> {
    const resolvedOptions = {
      ...this.defaults,
      ...options,
    };
    const lockPath = this.lockPathFor(targetPath);
    const startedAt = Date.now();
    const ownerId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    await mkdir(dirname(lockPath), { recursive: true });

    while (true) {
      try {
        await writeFile(lockPath, JSON.stringify({
          ownerId,
          pid: process.pid,
          createdAt: new Date().toISOString(),
        }, null, 2), {
          encoding: 'utf8',
          flag: 'wx',
        });

        break;
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;

        if (nodeError.code !== 'EEXIST') {
          throw error;
        }

        const existingLock = await stat(lockPath).catch(() => undefined);

        if (existingLock && Date.now() - existingLock.mtimeMs > resolvedOptions.staleMs) {
          await rm(lockPath, { force: true }).catch(() => undefined);
          continue;
        }

        if (Date.now() - startedAt > resolvedOptions.timeoutMs) {
          throw new Error(`Timed out while waiting for lock '${lockPath}'.`);
        }

        await delay(resolvedOptions.retryDelayMs);
      }
    }

    try {
      return await operation();
    } finally {
      await rm(lockPath, { force: true }).catch(() => undefined);
    }
  }
}

export interface AtomicJsonWriterOptions {
  readonly indent?: number;
}

export class AtomicJsonWriter {
  async write<TValue>(targetPath: string, value: TValue, options: AtomicJsonWriterOptions = {}): Promise<void> {
    const directoryPath = dirname(targetPath);
    const tempPath = join(
      directoryPath,
      `.${Date.now()}-${Math.random().toString(16).slice(2)}.${Math.abs(process.pid)}.tmp`,
    );
    const serialized = `${JSON.stringify(value, null, options.indent ?? 2)}\n`;

    await mkdir(directoryPath, { recursive: true });

    await writeFile(tempPath, serialized, 'utf8');

    const handle = await open(tempPath, 'r');

    try {
      await handle.sync();
    } finally {
      await handle.close();
    }

    await rename(tempPath, targetPath);
  }
}

export class GroupCalendarSchemaValidator {
  private readonly calendarMigrators = new Map<number, (value: unknown) => unknown>();

  private readonly settingsMigrators = new Map<number, (value: unknown) => unknown>();

  registerCalendarMigrator(schemaVersion: number, migrator: (value: unknown) => unknown): void {
    this.calendarMigrators.set(schemaVersion, migrator);
  }

  registerSettingsMigrator(schemaVersion: number, migrator: (value: unknown) => unknown): void {
    this.settingsMigrators.set(schemaVersion, migrator);
  }

  validateSettings(value: unknown): GroupWorkspaceSettingsFile {
    const migrated = this.migrate(value, SETTINGS_SCHEMA_VERSION, this.settingsMigrators);
    return workspaceSettingsSchema.parse(migrated);
  }

  validateCalendar(value: unknown): GroupCalendarMonthFile {
    const migrated = this.migrate(value, CALENDAR_SCHEMA_VERSION, this.calendarMigrators);
    return calendarMonthSchema.parse(migrated);
  }

  createDefaultSettings(input: Partial<Omit<GroupWorkspaceSettingsFile, 'schemaVersion' | 'calendarSchemaVersion'>> = {}): GroupWorkspaceSettingsFile {
    return this.validateSettings({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      calendarSchemaVersion: CALENDAR_SCHEMA_VERSION,
      timezone: input.timezone ?? DEFAULT_TIMEZONE,
      updatedAt: input.updatedAt ?? new Date().toISOString(),
    });
  }

  createEmptyCalendarMonth(input: GroupCalendarCreationInput): GroupCalendarMonthFile {
    return this.validateCalendar({
      schemaVersion: CALENDAR_SCHEMA_VERSION,
      groupJid: input.groupJid,
      groupLabel: input.groupLabel,
      year: input.year,
      month: input.month,
      timezone: input.timezone ?? DEFAULT_TIMEZONE,
      events: [],
    });
  }

  private migrate(
    value: unknown,
    targetVersion: number,
    migrators: Map<number, (value: unknown) => unknown>,
  ): unknown {
    if (!value || typeof value !== 'object') {
      return value;
    }

    const currentVersion = (value as { schemaVersion?: unknown }).schemaVersion;

    if (currentVersion === targetVersion || typeof currentVersion !== 'number') {
      return value;
    }

    const migrator = migrators.get(currentVersion);

    if (!migrator) {
      throw new Error(`No migrator registered for schemaVersion ${currentVersion}.`);
    }

    return migrator(value);
  }
}

async function readJsonFile<TValue>(filePath: string): Promise<TValue> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as TValue;
}

export class WeeklyProjectionBuilder {
  build(calendar: GroupCalendarMonthFile): readonly GroupWeekViewFile[] {
    const grouped = new Map<string, GroupCalendarEventRecord[]>();

    for (const event of calendar.events) {
      const bucket = grouped.get(event.weekId) ?? [];
      bucket.push(event);
      grouped.set(event.weekId, bucket);
    }

    return [...grouped.entries()].map(([weekId, events]) => ({
      schemaVersion: 1,
      groupJid: calendar.groupJid,
      groupLabel: calendar.groupLabel,
      weekId,
      timezone: calendar.timezone,
      generatedAt: new Date().toISOString(),
      events,
    }));
  }
}

export class GroupWorkspaceRepository {
  constructor(
    private readonly pathResolver = new GroupPathResolver(),
    private readonly lockManager = new GroupFileLockManager(),
    private readonly writer = new AtomicJsonWriter(),
    private readonly validator = new GroupCalendarSchemaValidator(),
  ) {}

  async readSettings(): Promise<GroupWorkspaceSettingsFile | undefined> {
    const settingsPath = this.pathResolver.resolveWorkspaceSettingsPath();

    try {
      return this.validator.validateSettings(await readJsonFile(settingsPath));
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        return undefined;
      }

      throw error;
    }
  }

  async ensureSettings(
    input: Partial<Omit<GroupWorkspaceSettingsFile, 'schemaVersion' | 'calendarSchemaVersion'>> = {},
  ): Promise<GroupWorkspaceSettingsFile> {
    const existing = await this.readSettings();

    if (existing) {
      return existing;
    }

    return this.saveSettings(this.validator.createDefaultSettings(input));
  }

  async saveSettings(value: GroupWorkspaceSettingsFile): Promise<GroupWorkspaceSettingsFile> {
    const settingsPath = this.pathResolver.resolveWorkspaceSettingsPath();
    const validated = this.validator.validateSettings({
      ...value,
      updatedAt: value.updatedAt ?? new Date().toISOString(),
    });

    await this.lockManager.withLock(settingsPath, async () => {
      await this.writer.write(settingsPath, validated);
    });

    return validated;
  }
}

export class GroupCalendarFileRepository {
  constructor(
    private readonly pathResolver = new GroupPathResolver(),
    private readonly lockManager = new GroupFileLockManager(),
    private readonly writer = new AtomicJsonWriter(),
    private readonly validator = new GroupCalendarSchemaValidator(),
  ) {}

  async readCalendarMonth(identity: GroupCalendarIdentity): Promise<GroupCalendarMonthFile | undefined> {
    const calendarPath = this.pathResolver.resolveGroupCalendarPath(identity.groupJid, identity.year, identity.month);

    try {
      return this.validator.validateCalendar(await readJsonFile(calendarPath));
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        return undefined;
      }

      throw error;
    }
  }

  async ensureCalendarMonth(input: GroupCalendarCreationInput): Promise<GroupCalendarMonthFile> {
    const existing = await this.readCalendarMonth(input);

    if (existing) {
      return existing;
    }

    return this.saveCalendarMonth(this.validator.createEmptyCalendarMonth(input));
  }

  async saveCalendarMonth(value: GroupCalendarMonthFile): Promise<GroupCalendarMonthFile> {
    const validated = this.validator.validateCalendar(value);
    const calendarPath = this.pathResolver.resolveGroupCalendarPath(validated.groupJid, validated.year, validated.month);

    await this.lockManager.withLock(calendarPath, async () => {
      await this.writer.write(calendarPath, validated);
    });

    return validated;
  }
}
