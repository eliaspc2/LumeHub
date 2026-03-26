export type DeliveryAttemptStatus = 'started' | 'observed' | 'confirmed' | 'failed';

export interface OutboundObservation {
  readonly jobId?: string;
  readonly messageId: string;
  readonly chatJid: string;
  readonly observedAt: string;
  readonly source: string;
}

export interface OutboundConfirmation {
  readonly jobId?: string;
  readonly messageId: string;
  readonly chatJid: string;
  readonly confirmedAt: string;
  readonly source: string;
  readonly ack: number;
}

export interface DeliveryAttempt {
  readonly attemptId: string;
  readonly jobId: string;
  readonly eventId: string;
  readonly weekId: string;
  readonly groupJid: string;
  readonly groupLabel: string;
  readonly messageId: string;
  readonly startedAt: string;
  readonly status: DeliveryAttemptStatus;
  readonly lastError: string | null;
  readonly observation?: OutboundObservation | null;
  readonly confirmation?: OutboundConfirmation | null;
}

export interface RegisterAttemptStartedInput {
  readonly jobId: string;
  readonly messageId: string;
  readonly attemptId?: string;
  readonly startedAt?: string | Date;
}
