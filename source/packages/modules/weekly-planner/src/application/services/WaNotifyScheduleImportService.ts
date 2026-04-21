import { readdir, readFile } from 'node:fs/promises';
import { basename, isAbsolute, resolve } from 'node:path';

import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { NotificationJobsModuleContract } from '@lume-hub/notification-jobs';
import type {
  NotificationRuleDefinitionInput,
  NotificationRulesModuleContract,
} from '@lume-hub/notification-rules';
import type { ScheduleEvent, ScheduleEventsModuleContract } from '@lume-hub/schedule-events';
import { WeekCalculator } from '@lume-hub/schedule-weeks';

import type {
  LegacyScheduleImportEventReport,
  LegacyScheduleImportFileSummary,
  LegacyScheduleImportIgnoredItem,
  LegacyScheduleImportInput,
  LegacyScheduleImportMissingGroup,
  LegacyScheduleImportReport,
} from '../../domain/entities/LegacyScheduleImport.js';

const DEFAULT_TIME_ZONE = 'Europe/Lisbon';
const DEFAULT_LEGACY_SCHEDULE_ROOT = '/home/eliaspc/Containers/wa-notify/data/schedules';
const PRE_REMINDER_SUFFIX_PATTERN = /::pre(?<minutes>\d+)m$/u;

interface WaNotifyLegacyScheduleFile {
  readonly weekId: string;
  readonly weekStart?: string;
  readonly weekEnd?: string;
  readonly items: readonly WaNotifyLegacyScheduleItem[];
}

interface WaNotifyLegacyScheduleItem {
  readonly id: string;
  readonly enabled?: boolean;
  readonly jid: string;
  readonly discipline?: string;
  readonly label?: string;
  readonly eventAt: string;
  readonly sendAt?: string;
  readonly text?: string;
  readonly deleteAfterSend?: boolean;
  readonly status?: string;
}

interface NormalizedLegacyEventCandidate {
  readonly baseEventId: string;
  readonly canonicalItem: WaNotifyLegacyScheduleItem;
  readonly items: readonly WaNotifyLegacyScheduleItem[];
  readonly localDate: string;
  readonly startTime: string;
  readonly weekId: string;
  readonly notificationRules: readonly NotificationRuleDefinitionInput[];
  readonly notes: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly title: string;
}

export interface WaNotifyScheduleImportServiceConfig {
  readonly groupDirectory: Pick<GroupDirectoryModuleContract, 'listGroups'>;
  readonly notificationJobs: Pick<NotificationJobsModuleContract, 'materializeForEvent'>;
  readonly notificationRules: Pick<NotificationRulesModuleContract, 'replaceRulesForEvent'>;
  readonly scheduleEvents: Pick<
    ScheduleEventsModuleContract,
    'createEvent' | 'updateEvent' | 'listEventsByWeek' | 'findEventById'
  >;
  readonly defaultTimeZone?: string;
  readonly weekCalculator?: WeekCalculator;
  readonly legacyScheduleRootPath?: string;
}

export class WaNotifyScheduleImportService {
  private readonly defaultTimeZone: string;
  private readonly weekCalculator: WeekCalculator;
  private readonly legacyScheduleRootPath: string;

  constructor(private readonly config: WaNotifyScheduleImportServiceConfig) {
    this.defaultTimeZone = config.defaultTimeZone ?? DEFAULT_TIME_ZONE;
    this.weekCalculator = config.weekCalculator ?? new WeekCalculator();
    this.legacyScheduleRootPath = config.legacyScheduleRootPath ?? DEFAULT_LEGACY_SCHEDULE_ROOT;
  }

  async listLegacyScheduleFiles(): Promise<readonly LegacyScheduleImportFileSummary[]> {
    const entries = await readdir(this.legacyScheduleRootPath, {
      withFileTypes: true,
    }).catch(() => []);
    const fileNames = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => entry.name)
      .sort();
    const summaries = await Promise.all(
      fileNames.map(async (fileName) => {
        try {
          return await this.readLegacyFileSummary(resolve(this.legacyScheduleRootPath, fileName));
        } catch {
          return null;
        }
      }),
    );

    return summaries.filter((summary): summary is LegacyScheduleImportFileSummary => summary !== null);
  }

  async previewImport(input: LegacyScheduleImportInput): Promise<LegacyScheduleImportReport> {
    return this.runImport(input, 'preview');
  }

  async applyImport(input: LegacyScheduleImportInput): Promise<LegacyScheduleImportReport> {
    return this.runImport(input, 'apply');
  }

  private async runImport(
    input: LegacyScheduleImportInput,
    mode: 'preview' | 'apply',
  ): Promise<LegacyScheduleImportReport> {
    const filePath = this.resolveFilePath(input);
    const file = await this.readLegacyFile(filePath);
    const fileSummary = this.buildFileSummary(filePath, file);
    const groups = await this.config.groupDirectory.listGroups();
    const groupsByJid = new Map(groups.map((group) => [group.groupJid, group]));
    const ignoredItems: LegacyScheduleImportIgnoredItem[] = [];
    const missingGroups = new Map<string, number>();
    const events: LegacyScheduleImportEventReport[] = [];
    const defaultDurationMinutes = input.defaultDurationMinutes ?? 60;
    const enabledItems = file.items.filter((item) => item.enabled !== false);

    for (const item of file.items) {
      if (item.enabled === false) {
        ignoredItems.push({
          legacyItemId: item.id,
          groupJid: item.jid,
          reason: 'Item legacy desativado; nao foi considerado para migracao.',
        });
      }
    }

    const itemsByBaseEventId = new Map<string, WaNotifyLegacyScheduleItem[]>();

    for (const item of enabledItems) {
      const baseEventId = normaliseBaseEventId(item.id);
      const current = itemsByBaseEventId.get(baseEventId) ?? [];
      current.push(item);
      itemsByBaseEventId.set(baseEventId, current);
    }

    for (const [baseEventId, items] of itemsByBaseEventId.entries()) {
      const candidate = this.buildLegacyEventCandidate(baseEventId, items, fileSummary.fileName, defaultDurationMinutes);
      const mappedGroup = groupsByJid.get(candidate.canonicalItem.jid);

      if (!mappedGroup) {
        missingGroups.set(candidate.canonicalItem.jid, (missingGroups.get(candidate.canonicalItem.jid) ?? 0) + items.length);
        events.push({
          legacyEventId: baseEventId,
          groupJid: candidate.canonicalItem.jid,
          groupLabel: null,
          title: candidate.title,
          weekId: candidate.weekId,
          localDate: candidate.localDate,
          startTime: candidate.startTime,
          status: 'ambiguous',
          reason: 'Grupo legacy nao existe no group-directory atual.',
          notificationRuleLabels: candidate.notificationRules.map((rule) => rule.label ?? rule.kind),
        });
        continue;
      }

      const existingEvent = await this.config.scheduleEvents.findEventById(baseEventId, {
        groupJid: mappedGroup.groupJid,
      });

      if (existingEvent && !isLegacyImportedEvent(existingEvent, baseEventId)) {
        events.push({
          legacyEventId: baseEventId,
          groupJid: mappedGroup.groupJid,
          groupLabel: mappedGroup.preferredSubject,
          title: candidate.title,
          weekId: candidate.weekId,
          localDate: candidate.localDate,
          startTime: candidate.startTime,
          status: 'ambiguous',
          reason: 'Ja existe um evento com este ID mas sem metadata de import legacy.',
          notificationRuleLabels: candidate.notificationRules.map((rule) => rule.label ?? rule.kind),
        });
        continue;
      }

      const plannedStatus = describeImportStatus(existingEvent, candidate);

      events.push({
        legacyEventId: baseEventId,
        groupJid: mappedGroup.groupJid,
        groupLabel: mappedGroup.preferredSubject,
        title: candidate.title,
        weekId: candidate.weekId,
        localDate: candidate.localDate,
        startTime: candidate.startTime,
        status: plannedStatus,
        reason: plannedStatus === 'unchanged' ? 'Ja existe no calendario com os mesmos dados importados.' : null,
        notificationRuleLabels: candidate.notificationRules.map((rule) => rule.label ?? rule.kind),
      });

      if (mode === 'apply' && (plannedStatus === 'created' || plannedStatus === 'updated')) {
        const event = existingEvent
          ? await this.config.scheduleEvents.updateEvent(
              baseEventId,
              {
                title: candidate.title,
                eventAt: candidate.canonicalItem.eventAt,
                metadata: candidate.metadata,
              },
              {
                groupJid: mappedGroup.groupJid,
              },
            )
          : await this.config.scheduleEvents.createEvent({
              eventId: baseEventId,
              groupJid: mappedGroup.groupJid,
              groupLabel: mappedGroup.preferredSubject,
              title: candidate.title,
              eventAt: candidate.canonicalItem.eventAt,
              timeZone: this.defaultTimeZone,
              metadata: candidate.metadata,
            });

        await this.config.notificationRules.replaceRulesForEvent(event.eventId, candidate.notificationRules, {
          groupJid: mappedGroup.groupJid,
        });
        await this.config.notificationJobs.materializeForEvent(event.eventId, {
          groupJid: mappedGroup.groupJid,
        });
      }
    }

    const totals = {
      legacyItems: file.items.length,
      baseEvents: itemsByBaseEventId.size,
      created: events.filter((event) => event.status === 'created').length,
      updated: events.filter((event) => event.status === 'updated').length,
      unchanged: events.filter((event) => event.status === 'unchanged').length,
      ignored: ignoredItems.length + events.filter((event) => event.status === 'ignored').length,
      ambiguous: events.filter((event) => event.status === 'ambiguous').length,
      matchedGroups: new Set(events.filter((event) => event.groupLabel).map((event) => event.groupJid)).size,
      missingGroups: missingGroups.size,
    };
    const notes = [
      `Duracao assumida para eventos legacy sem duracao explicita: ${defaultDurationMinutes} minutos.`,
      mode === 'preview'
        ? 'Preview sem alterar o calendario real.'
        : 'Import aplicado no calendario real, com notificacoes rematerializadas a partir das regras derivadas.',
    ];

    return {
      mode,
      generatedAt: new Date().toISOString(),
      sourceFile: fileSummary,
      totals,
      events: events.sort(
        (left, right) =>
          left.groupJid.localeCompare(right.groupJid) ||
          left.localDate.localeCompare(right.localDate) ||
          left.startTime.localeCompare(right.startTime) ||
          left.legacyEventId.localeCompare(right.legacyEventId),
      ),
      ignoredItems,
      missingGroups: [...missingGroups.entries()]
        .map(([groupJid, itemCount]): LegacyScheduleImportMissingGroup => ({
          groupJid,
          itemCount,
        }))
        .sort((left, right) => left.groupJid.localeCompare(right.groupJid)),
      notes,
    };
  }

  private resolveFilePath(input: LegacyScheduleImportInput): string {
    const rawPath = input.filePath?.trim() || input.fileName?.trim();

    if (!rawPath) {
      throw new Error('Indica o ficheiro legacy do WA-notify que queres importar.');
    }

    return isAbsolute(rawPath) ? rawPath : resolve(this.legacyScheduleRootPath, rawPath);
  }

  private async readLegacyFileSummary(filePath: string): Promise<LegacyScheduleImportFileSummary> {
    return this.buildFileSummary(filePath, await this.readLegacyFile(filePath));
  }

  private async readLegacyFile(filePath: string): Promise<WaNotifyLegacyScheduleFile> {
    const rawContent = await readFile(filePath, 'utf8');
    const value = JSON.parse(rawContent) as Partial<WaNotifyLegacyScheduleFile>;

    if (!value || typeof value !== 'object' || !Array.isArray(value.items)) {
      throw new Error(`Ficheiro legacy invalido em '${filePath}'.`);
    }

    return {
      weekId: typeof value.weekId === 'string' ? value.weekId : basename(filePath, '.json'),
      weekStart: typeof value.weekStart === 'string' ? value.weekStart : undefined,
      weekEnd: typeof value.weekEnd === 'string' ? value.weekEnd : undefined,
      items: value.items.filter((item): item is WaNotifyLegacyScheduleItem => {
        return Boolean(item && typeof item === 'object' && typeof item.id === 'string' && typeof item.jid === 'string');
      }),
    };
  }

  private buildFileSummary(filePath: string, file: WaNotifyLegacyScheduleFile): LegacyScheduleImportFileSummary {
    const enabledItems = file.items.filter((item) => item.enabled !== false);
    const isoWeekId =
      file.weekStart && /^\d{4}-\d{2}-\d{2}$/u.test(file.weekStart)
        ? this.weekCalculator.weekIdForDate(`${file.weekStart}T12:00:00.000Z`, this.defaultTimeZone)
        : null;

    return {
      fileName: basename(filePath),
      absolutePath: filePath,
      legacyWeekId: file.weekId,
      isoWeekId,
      weekStart: file.weekStart ?? null,
      weekEnd: file.weekEnd ?? null,
      itemCount: file.items.length,
      baseEventCount: new Set(enabledItems.map((item) => normaliseBaseEventId(item.id))).size,
      groupJids: [...new Set(enabledItems.map((item) => item.jid))].sort(),
    };
  }

  private buildLegacyEventCandidate(
    baseEventId: string,
    items: readonly WaNotifyLegacyScheduleItem[],
    sourceFileName: string,
    defaultDurationMinutes: number,
  ): NormalizedLegacyEventCandidate {
    const canonicalItem = items.find((item) => item.id === baseEventId) ?? items[0];
    const eventParts = this.weekCalculator.getLocalDateParts(canonicalItem.eventAt, this.defaultTimeZone);
    const localDate = `${String(eventParts.year).padStart(4, '0')}-${String(eventParts.month).padStart(2, '0')}-${String(eventParts.day).padStart(2, '0')}`;
    const startTime = `${String(eventParts.hour).padStart(2, '0')}:${String(eventParts.minute).padStart(2, '0')}`;
    const notificationRules = dedupeNotificationRules(
      items.flatMap<NotificationRuleDefinitionInput>((item) => {
        const preReminderMatch = PRE_REMINDER_SUFFIX_PATTERN.exec(item.id);

        if (preReminderMatch?.groups?.minutes) {
          const offsetMinutesBeforeEvent = Number(preReminderMatch.groups.minutes);
          const legacyMessageTemplate = normaliseLegacyMessageTemplate(item.text);

          return [
            {
              kind: 'relative_before_event' as const,
              label: `Lembrete ${offsetMinutesBeforeEvent} min antes`,
              offsetMinutesBeforeEvent,
              messageTemplate: legacyMessageTemplate,
              llmPromptTemplate: legacyMessageTemplate ? null : undefined,
            },
          ];
        }

        if (!item.sendAt) {
          return [];
        }

        const sendParts = this.weekCalculator.getLocalDateParts(item.sendAt, this.defaultTimeZone);
        const localTime = `${String(sendParts.hour).padStart(2, '0')}:${String(sendParts.minute).padStart(2, '0')}`;
        const daysBeforeEvent = diffLocalDays(
          {
            year: eventParts.year,
            month: eventParts.month,
            day: eventParts.day,
          },
          {
            year: sendParts.year,
            month: sendParts.month,
            day: sendParts.day,
          },
        );

        if (daysBeforeEvent < 0) {
          return [];
        }

        const legacyMessageTemplate = normaliseLegacyMessageTemplate(item.text);

        return [
          {
            kind: 'fixed_local_time' as const,
            label: daysBeforeEvent === 0 ? `No proprio dia as ${localTime}` : `${daysBeforeEvent} dia(s) antes as ${localTime}`,
            daysBeforeEvent,
            localTime,
            messageTemplate: legacyMessageTemplate,
            llmPromptTemplate: legacyMessageTemplate ? null : undefined,
          },
        ];
      }),
    );
    const title = (canonicalItem.label ?? baseEventId).replace(/\s+\(lembrete.*\)$/iu, '').trim();
    const legacyTexts = items
      .map((item) => item.text?.trim())
      .filter((value): value is string => Boolean(value));
    const discipline = canonicalItem.discipline?.trim() || null;
    const notes = [
      'Importado do WA-notify.',
      discipline ? `Disciplina legacy: ${discipline}.` : null,
      legacyTexts[0] ? `Mensagem legacy: ${legacyTexts[0]}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ');

    return {
      baseEventId,
      canonicalItem,
      items,
      localDate,
      startTime,
      weekId: this.weekCalculator.weekIdForDate(canonicalItem.eventAt, this.defaultTimeZone),
      notificationRules,
      notes,
      title,
      metadata: {
        durationMinutes: defaultDurationMinutes,
        notes,
        legacyImport: {
          source: 'wa-notify',
          sourceFileName,
          legacyWeekId: basename(sourceFileName, '.json'),
          legacyEventId: baseEventId,
          sourceItemIds: items.map((item) => item.id),
          sourceStatuses: items.map((item) => item.status ?? null),
          deleteAfterSend: items.some((item) => item.deleteAfterSend === true),
          discipline,
          messageSamples: legacyTexts,
        },
      },
    };
  }
}

function normaliseBaseEventId(itemId: string): string {
  return itemId.split('::')[0] ?? itemId;
}

function diffLocalDays(
  eventDate: { readonly year: number; readonly month: number; readonly day: number },
  sendDate: { readonly year: number; readonly month: number; readonly day: number },
): number {
  const eventAnchor = Date.UTC(eventDate.year, eventDate.month - 1, eventDate.day, 12, 0, 0, 0);
  const sendAnchor = Date.UTC(sendDate.year, sendDate.month - 1, sendDate.day, 12, 0, 0, 0);
  return Math.round((eventAnchor - sendAnchor) / 86_400_000);
}

function dedupeNotificationRules(
  rules: readonly NotificationRuleDefinitionInput[],
): readonly NotificationRuleDefinitionInput[] {
  const byKey = new Map<string, NotificationRuleDefinitionInput>();

  for (const rule of rules) {
    const key =
      rule.kind === 'relative_before_event'
        ? `${rule.kind}:${rule.offsetMinutesBeforeEvent ?? ''}`
        : `${rule.kind}:${rule.daysBeforeEvent ?? ''}:${rule.localTime ?? ''}`;

    if (!byKey.has(key)) {
      byKey.set(key, rule);
    }
  }

  return [...byKey.values()];
}

function isLegacyImportedEvent(event: ScheduleEvent, legacyEventId: string): boolean {
  const legacyImport = readLegacyImportMetadata(event.metadata);
  return legacyImport?.source === 'wa-notify' && legacyImport.legacyEventId === legacyEventId;
}

function describeImportStatus(
  existingEvent: ScheduleEvent | undefined,
  candidate: NormalizedLegacyEventCandidate,
): LegacyScheduleImportEventReport['status'] {
  if (!existingEvent) {
    return 'created';
  }

  const existingDurationMinutes = readNumericMetadata(existingEvent.metadata, 'durationMinutes', 60);
  const nextDurationMinutes = readNumericMetadata(candidate.metadata, 'durationMinutes', 60);
  const existingNotes = readStringMetadata(existingEvent.metadata, 'notes');
  const nextNotes = readStringMetadata(candidate.metadata, 'notes');
  const existingRules = normaliseRuleSignature(existingEvent.notificationRules);
  const nextRules = normaliseRuleSignature(candidate.notificationRules);

  if (
    existingEvent.title === candidate.title &&
    existingEvent.eventAt === candidate.canonicalItem.eventAt &&
    existingDurationMinutes === nextDurationMinutes &&
    existingNotes === nextNotes &&
    existingRules === nextRules
  ) {
    return 'unchanged';
  }

  return 'updated';
}

function normaliseRuleSignature(
  rules: readonly {
    readonly kind: string;
    readonly offsetMinutesBeforeEvent?: number | null;
    readonly daysBeforeEvent?: number | null;
    readonly localTime?: string | null;
    readonly messageTemplate?: string | null;
    readonly llmPromptTemplate?: string | null;
  }[],
): string {
  return rules
    .map((rule) => {
      const templateSignature = `${signatureString(rule.messageTemplate)}:${signatureString(rule.llmPromptTemplate)}`;

      return rule.kind === 'relative_before_event'
        ? `${rule.kind}:${rule.offsetMinutesBeforeEvent ?? ''}:${templateSignature}`
        : `${rule.kind}:${rule.daysBeforeEvent ?? ''}:${rule.localTime ?? ''}:${templateSignature}`;
    })
    .sort()
    .join('|');
}

function signatureString(value: string | null | undefined): string {
  return value ?? '';
}

function normaliseLegacyMessageTemplate(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readLegacyImportMetadata(metadata: Readonly<Record<string, unknown>> | undefined): {
  readonly source?: string;
  readonly legacyEventId?: string;
} | null {
  const value = metadata?.legacyImport;
  return value && typeof value === 'object' ? (value as { readonly source?: string; readonly legacyEventId?: string }) : null;
}

function readNumericMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
  key: string,
  fallback: number,
): number {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readStringMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : '';
}
