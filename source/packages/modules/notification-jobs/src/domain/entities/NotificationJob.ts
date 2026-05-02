export type NotificationJobStatus = 'pending' | 'waiting_confirmation' | 'sent';

export interface NotificationJob {
  readonly jobId: string;
  readonly eventId: string;
  readonly ruleId: string;
  readonly weekId: string;
  readonly groupJid: string;
  readonly groupLabel: string;
  readonly title: string;
  readonly kind: string;
  readonly eventAt: string;
  readonly timeZone: string;
  readonly ruleType: string;
  readonly ruleLabel: string | null;
  readonly mediaAssetId: string | null;
  readonly messageTemplate: string | null;
  readonly llmPromptTemplate: string | null;
  readonly sendAt: string;
  readonly status: NotificationJobStatus;
  readonly preparedAt: string | null;
  readonly preparedInstructionId: string | null;
  readonly preparedActionId: string | null;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly lastOutboundObservationAt: string | null;
  readonly confirmedAt: string | null;
  readonly suppressedAt?: string | null;
  readonly disabledAt?: string | null;
}
