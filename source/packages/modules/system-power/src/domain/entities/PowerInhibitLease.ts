import type { PowerDemandReason } from './PowerDemandReason.js';

export interface PowerInhibitLease {
  readonly leaseId: string;
  readonly reasons: readonly PowerDemandReason[];
  readonly explanation: string;
  readonly acquiredAt: string;
  readonly releasedAt: string | null;
}
