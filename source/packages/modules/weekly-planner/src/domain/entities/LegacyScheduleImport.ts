export interface LegacyScheduleImportFileSummary {
  readonly fileName: string;
  readonly absolutePath: string;
  readonly legacyWeekId: string;
  readonly isoWeekId: string | null;
  readonly weekStart: string | null;
  readonly weekEnd: string | null;
  readonly itemCount: number;
  readonly baseEventCount: number;
  readonly groupJids: readonly string[];
}

export interface LegacyScheduleImportInput {
  readonly fileName?: string;
  readonly filePath?: string;
  readonly defaultDurationMinutes?: number;
  readonly requestedBy?: string | null;
}

export type LegacyScheduleImportEventStatus = 'created' | 'updated' | 'unchanged' | 'ignored' | 'ambiguous';

export interface LegacyScheduleImportEventReport {
  readonly legacyEventId: string;
  readonly groupJid: string;
  readonly groupLabel: string | null;
  readonly title: string;
  readonly weekId: string;
  readonly localDate: string;
  readonly startTime: string;
  readonly status: LegacyScheduleImportEventStatus;
  readonly reason: string | null;
  readonly notificationRuleLabels: readonly string[];
}

export interface LegacyScheduleImportIgnoredItem {
  readonly legacyItemId: string;
  readonly groupJid: string;
  readonly reason: string;
}

export interface LegacyScheduleImportMissingGroup {
  readonly groupJid: string;
  readonly itemCount: number;
}

export interface LegacyScheduleImportReport {
  readonly mode: 'preview' | 'apply';
  readonly generatedAt: string;
  readonly sourceFile: LegacyScheduleImportFileSummary;
  readonly totals: {
    readonly legacyItems: number;
    readonly baseEvents: number;
    readonly created: number;
    readonly updated: number;
    readonly unchanged: number;
    readonly ignored: number;
    readonly ambiguous: number;
    readonly matchedGroups: number;
    readonly missingGroups: number;
  };
  readonly events: readonly LegacyScheduleImportEventReport[];
  readonly ignoredItems: readonly LegacyScheduleImportIgnoredItem[];
  readonly missingGroups: readonly LegacyScheduleImportMissingGroup[];
  readonly notes: readonly string[];
}
