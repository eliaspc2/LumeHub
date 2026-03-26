export type NotificationRuleKind = 'relative_before_event' | 'fixed_local_time';

export interface NotificationRule {
  readonly ruleId: string;
  readonly eventId: string;
  readonly weekId: string;
  readonly kind: NotificationRuleKind;
  readonly enabled: boolean;
  readonly label: string | null;
  readonly offsetMinutesBeforeEvent?: number | null;
  readonly daysBeforeEvent?: number | null;
  readonly localTime?: string | null;
}

export interface NotificationRuleDefinitionInput {
  readonly ruleId?: string;
  readonly kind: NotificationRuleKind;
  readonly enabled?: boolean;
  readonly label?: string | null;
  readonly offsetMinutesBeforeEvent?: number | null;
  readonly daysBeforeEvent?: number | null;
  readonly localTime?: string | null;
}
