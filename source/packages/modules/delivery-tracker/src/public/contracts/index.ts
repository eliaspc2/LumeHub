export type {
  DeliveryAttempt,
  DeliveryAttemptStatus,
  OutboundConfirmation,
  OutboundObservation,
  RegisterAttemptStartedInput,
} from '../../domain/entities/DeliveryAttempt.js';
export type {
  DeliveryAttemptLookupQuery,
  DeliveryAttemptQuery,
} from '../../domain/repositories/DeliveryAttemptRepository.js';
export type { DeliveryAttemptResolution } from '../../application/services/DeliveryTrackerService.js';

export interface DeliveryTrackerModuleContract {
  readonly moduleName: 'delivery-tracker';
  registerAttemptStarted(
    input: import('../../domain/entities/DeliveryAttempt.js').RegisterAttemptStartedInput,
    query?: import('../../domain/repositories/DeliveryAttemptRepository.js').DeliveryAttemptLookupQuery,
  ): Promise<import('../../domain/entities/DeliveryAttempt.js').DeliveryAttempt>;
  registerObservation(
    observation: Omit<import('../../domain/entities/DeliveryAttempt.js').OutboundObservation, 'observedAt'> & {
      readonly observedAt?: string;
    },
    query?: import('../../domain/repositories/DeliveryAttemptRepository.js').DeliveryAttemptLookupQuery,
  ): Promise<import('../../domain/entities/DeliveryAttempt.js').DeliveryAttempt | undefined>;
  registerConfirmation(
    confirmation: Omit<import('../../domain/entities/DeliveryAttempt.js').OutboundConfirmation, 'confirmedAt'> & {
      readonly confirmedAt?: string;
    },
    query?: import('../../domain/repositories/DeliveryAttemptRepository.js').DeliveryAttemptLookupQuery,
  ): Promise<import('../../domain/entities/DeliveryAttempt.js').DeliveryAttempt | undefined>;
  resolvePendingAttempt(
    jobId: string,
    query?: import('../../domain/repositories/DeliveryAttemptRepository.js').DeliveryAttemptLookupQuery,
  ): Promise<import('../../application/services/DeliveryTrackerService.js').DeliveryAttemptResolution | undefined>;
}
