import type { DeliveryAttempt, DeliveryAttemptStatus } from '../entities/DeliveryAttempt.js';

export interface DeliveryAttemptQuery {
  readonly groupJid?: string;
  readonly jobId?: string;
  readonly messageId?: string;
  readonly status?: DeliveryAttemptStatus;
}

export interface DeliveryAttemptLookupQuery {
  readonly groupJid?: string;
}

export interface DeliveryAttemptRepository {
  listAttempts(query?: DeliveryAttemptQuery): Promise<readonly DeliveryAttempt[]>;
  readAttemptById(attemptId: string, query?: DeliveryAttemptLookupQuery): Promise<DeliveryAttempt | undefined>;
  readAttemptByMessageId(messageId: string, query?: DeliveryAttemptLookupQuery): Promise<DeliveryAttempt | undefined>;
  readLatestAttemptForJob(jobId: string, query?: DeliveryAttemptLookupQuery): Promise<DeliveryAttempt | undefined>;
  saveAttempt(attempt: DeliveryAttempt): Promise<DeliveryAttempt>;
}
