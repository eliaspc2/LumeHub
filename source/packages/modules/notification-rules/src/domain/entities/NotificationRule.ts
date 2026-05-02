export type NotificationRuleKind = 'relative_before_event' | 'fixed_local_time' | 'relative_after_event';

export interface NotificationRule {
  readonly ruleId: string;
  readonly eventId: string;
  readonly weekId: string;
  readonly kind: NotificationRuleKind;
  readonly enabled: boolean;
  readonly label: string | null;
  readonly mediaAssetId?: string | null;
  readonly offsetMinutesBeforeEvent?: number | null;
  readonly offsetMinutesAfterEvent?: number | null;
  readonly daysBeforeEvent?: number | null;
  readonly localTime?: string | null;
  readonly messageTemplate?: string | null;
  readonly llmPromptTemplate?: string | null;
}

export interface NotificationRuleDefinitionInput {
  readonly ruleId?: string;
  readonly kind: NotificationRuleKind;
  readonly enabled?: boolean;
  readonly label?: string | null;
  readonly mediaAssetId?: string | null;
  readonly offsetMinutesBeforeEvent?: number | null;
  readonly offsetMinutesAfterEvent?: number | null;
  readonly daysBeforeEvent?: number | null;
  readonly localTime?: string | null;
  readonly messageTemplate?: string | null;
  readonly llmPromptTemplate?: string | null;
}
