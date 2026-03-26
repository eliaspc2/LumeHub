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
  readonly sendAt: string;
  readonly status: NotificationJobStatus;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly lastOutboundObservationAt: string | null;
  readonly confirmedAt: string | null;
  readonly suppressedAt?: string | null;
  readonly disabledAt?: string | null;
}
