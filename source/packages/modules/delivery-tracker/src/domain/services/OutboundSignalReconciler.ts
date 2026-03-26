import type { DeliveryAttempt, OutboundConfirmation, OutboundObservation } from '../entities/DeliveryAttempt.js';

export class OutboundSignalReconciler {
  applyObservation(attempt: DeliveryAttempt, observation: OutboundObservation): DeliveryAttempt {
    return {
      ...attempt,
      status: attempt.confirmation ? 'confirmed' : 'observed',
      observation,
    };
  }

  applyConfirmation(attempt: DeliveryAttempt, confirmation: OutboundConfirmation): DeliveryAttempt {
    return {
      ...attempt,
      status: 'confirmed',
      confirmation,
    };
  }
}
