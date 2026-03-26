import {
  SERVER_ACK,
  type OutboundConfirmationSignal,
  type OutboundObservationSignal,
} from './types.js';

export class OutboundConfirmationTracker {
  private readonly observationKeys = new Set<string>();
  private readonly confirmationKeys = new Set<string>();

  captureObservation(
    signal: Omit<OutboundObservationSignal, 'observedAt'> & { readonly observedAt?: string },
  ): OutboundObservationSignal | undefined {
    const normalized: OutboundObservationSignal = {
      ...signal,
      observedAt: signal.observedAt ?? new Date().toISOString(),
    };
    const key = `${normalized.messageId}:${normalized.source}:${normalized.observedAt}`;

    if (this.observationKeys.has(key)) {
      return undefined;
    }

    this.observationKeys.add(key);
    return normalized;
  }

  captureConfirmation(
    signal: Omit<OutboundConfirmationSignal, 'confirmedAt'> & { readonly confirmedAt?: string },
  ): OutboundConfirmationSignal | undefined {
    if (signal.ack < SERVER_ACK) {
      return undefined;
    }

    const normalized: OutboundConfirmationSignal = {
      ...signal,
      confirmedAt: signal.confirmedAt ?? new Date().toISOString(),
    };
    const key = `${normalized.messageId}:${normalized.source}:${normalized.ack}:${normalized.confirmedAt}`;

    if (this.confirmationKeys.has(key)) {
      return undefined;
    }

    this.confirmationKeys.add(key);
    return normalized;
  }
}
