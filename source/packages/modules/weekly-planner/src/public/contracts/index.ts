import type { NotificationRuleDefinitionInput } from '@lume-hub/notification-rules';

export interface WeeklyPlannerGroupSummary {
  readonly groupJid: string;
  readonly preferredSubject: string;
  readonly courseId: string | null;
  readonly ownerLabels: readonly string[];
}

export interface WeeklyPlannerNotificationSummary {
  readonly pending: number;
  readonly waitingConfirmation: number;
  readonly sent: number;
  readonly total: number;
}

export interface WeeklyPlannerEventSummary {
  readonly eventId: string;
  readonly weekId: string;
  readonly groupJid: string;
  readonly groupLabel: string;
  readonly title: string;
  readonly eventAt: string;
  readonly localDate: string;
  readonly dayLabel: string;
  readonly startTime: string;
  readonly durationMinutes: number;
  readonly notes: string;
  readonly notificationRuleLabels: readonly string[];
  readonly notifications: WeeklyPlannerNotificationSummary;
}

export interface WeeklyPlannerSnapshot {
  readonly timezone: string;
  readonly focusWeekLabel: string;
  readonly focusWeekRangeLabel: string;
  readonly groupsKnown: number;
  readonly groups: readonly WeeklyPlannerGroupSummary[];
  readonly defaultNotificationRuleLabels: readonly string[];
  readonly events: readonly WeeklyPlannerEventSummary[];
  readonly diagnostics: {
    readonly eventCount: number;
    readonly pendingNotifications: number;
    readonly waitingConfirmationNotifications: number;
    readonly sentNotifications: number;
  };
}

export interface WeeklyPlannerQuery {
  readonly weekId?: string;
  readonly groupJid?: string;
  readonly timeZone?: string;
  readonly now?: Date;
}

export interface WeeklyPlannerUpsertInput {
  readonly eventId?: string;
  readonly weekId?: string;
  readonly groupJid: string;
  readonly title: string;
  readonly dayLabel?: string;
  readonly localDate?: string;
  readonly startTime: string;
  readonly durationMinutes: number;
  readonly notes?: string | null;
  readonly timeZone?: string;
  readonly notificationRules?: readonly NotificationRuleDefinitionInput[];
}

export type {
  LegacyScheduleImportEventReport,
  LegacyScheduleImportEventStatus,
  LegacyScheduleImportFileSummary,
  LegacyScheduleImportIgnoredItem,
  LegacyScheduleImportInput,
  LegacyScheduleImportMissingGroup,
  LegacyScheduleImportReport,
} from '../../domain/entities/LegacyScheduleImport.js';

export interface WeeklyPlannerModuleContract {
  readonly moduleName: 'weekly-planner';
  getWeekSnapshot(query?: WeeklyPlannerQuery): Promise<WeeklyPlannerSnapshot>;
  saveSchedule(input: WeeklyPlannerUpsertInput): Promise<WeeklyPlannerEventSummary>;
  deleteSchedule(
    eventId: string,
    query?: {
      readonly groupJid?: string;
    },
  ): Promise<boolean>;
  listLegacyScheduleFiles(): Promise<
    readonly import('../../domain/entities/LegacyScheduleImport.js').LegacyScheduleImportFileSummary[]
  >;
  previewLegacyScheduleImport(
    input: import('../../domain/entities/LegacyScheduleImport.js').LegacyScheduleImportInput,
  ): Promise<import('../../domain/entities/LegacyScheduleImport.js').LegacyScheduleImportReport>;
  applyLegacyScheduleImport(
    input: import('../../domain/entities/LegacyScheduleImport.js').LegacyScheduleImportInput,
  ): Promise<import('../../domain/entities/LegacyScheduleImport.js').LegacyScheduleImportReport>;
}
