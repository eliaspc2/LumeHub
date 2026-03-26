import type { NotificationJob } from '@lume-hub/notification-jobs';

import type { DeliveryAttempt } from '../entities/DeliveryAttempt.js';

function sortAttempts(left: DeliveryAttempt, right: DeliveryAttempt): number {
  return right.startedAt.localeCompare(left.startedAt) || right.attemptId.localeCompare(left.attemptId);
}

export class DeliveryResolutionPolicy {
  resolve(job: NotificationJob, attempts: readonly DeliveryAttempt[]): NotificationJob {
    const sortedAttempts = attempts.slice().sort(sortAttempts);
    const confirmedAttempt = sortedAttempts.find((attempt) => attempt.confirmation);

    if (confirmedAttempt?.confirmation) {
      return {
        ...job,
        status: 'sent',
        confirmedAt: confirmedAttempt.confirmation.confirmedAt,
        lastOutboundObservationAt:
          confirmedAttempt.observation?.observedAt
          ?? job.lastOutboundObservationAt
          ?? null,
      };
    }

    const observedAttempt = sortedAttempts.find((attempt) => attempt.observation);

    if (observedAttempt || sortedAttempts.length > 0 || job.status === 'waiting_confirmation') {
      return {
        ...job,
        status: 'waiting_confirmation',
        lastOutboundObservationAt:
          observedAttempt?.observation?.observedAt
          ?? job.lastOutboundObservationAt
          ?? null,
      };
    }

    return job;
  }
}
