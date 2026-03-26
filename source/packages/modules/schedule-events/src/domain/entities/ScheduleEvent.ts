import type {
  GroupEventTargetRecord,
  GroupNotificationRecord,
  GroupNotificationRuleRecord,
} from '@lume-hub/persistence-group-files';

export type EventKind = 'generic' | (string & {});
export type EventTarget = GroupEventTargetRecord;

export interface ScheduleEvent {
  readonly eventId: string;
  readonly weekId: string;
  readonly groupJid: string;
  readonly groupLabel: string;
  readonly title: string;
  readonly kind: EventKind;
  readonly target?: EventTarget;
  readonly eventAt: string;
  readonly timeZone: string;
  readonly notificationRules: readonly GroupNotificationRuleRecord[];
  readonly notifications: readonly GroupNotificationRecord[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ScheduleEventCreateInput {
  readonly eventId?: string;
  readonly groupJid: string;
  readonly groupLabel: string;
  readonly title?: string;
  readonly kind?: EventKind;
  readonly target?: EventTarget;
  readonly eventAt: string | Date;
  readonly timeZone?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ScheduleEventUpdateInput {
  readonly title?: string;
  readonly kind?: EventKind;
  readonly target?: EventTarget | null;
  readonly eventAt?: string | Date;
  readonly metadata?: Readonly<Record<string, unknown>> | null;
  readonly notificationRules?: readonly GroupNotificationRuleRecord[];
  readonly notifications?: readonly GroupNotificationRecord[];
}
