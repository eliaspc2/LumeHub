import type { NotificationRuleDefinitionInput } from '@lume-hub/notification-rules';
import type { GroupOperationalSettings } from '@lume-hub/group-directory';

export interface WeeklyPlannerQuery {
  readonly weekId?: string;
  readonly groupJid?: string;
  readonly timeZone?: string;
  readonly now?: Date;
}

export interface WeeklyPlannerNotificationSummary {
  readonly pending: number;
  readonly waitingConfirmation: number;
  readonly sent: number;
  readonly total: number;
}

export interface WeeklyPlannerGroupSummary {
  readonly groupJid: string;
  readonly preferredSubject: string;
  readonly courseId: string | null;
  readonly ownerLabels: readonly string[];
  readonly operationalSettings: GroupOperationalSettings;
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
