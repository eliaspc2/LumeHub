import type { PowerDemandReason } from './PowerDemandReason.js';
import type { PowerInhibitLease } from './PowerInhibitLease.js';
import type { PowerPolicy } from './PowerPolicy.js';

export interface PowerStatus {
  readonly policy: PowerPolicy;
  readonly activeLease: PowerInhibitLease | null;
  readonly desiredState: 'inhibited' | 'released';
  readonly inhibitorActive: boolean;
  readonly inhibitorStatePath: string;
  readonly reasons: readonly PowerDemandReason[];
  readonly explanation: string;
  readonly updatedAt: string;
}
