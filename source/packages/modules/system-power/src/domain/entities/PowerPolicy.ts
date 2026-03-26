import type { PowerDemandReason } from './PowerDemandReason.js';

export type PowerPolicyMode = 'allow_sleep' | 'on_demand' | 'always_inhibit';

export interface PowerPolicy {
  readonly schemaVersion: 1;
  readonly enabled: boolean;
  readonly mode: PowerPolicyMode;
  readonly preferredReasons: readonly PowerDemandReason[];
  readonly updatedAt: string;
}

export interface PowerPolicyUpdate {
  readonly enabled?: boolean;
  readonly mode?: PowerPolicyMode;
  readonly preferredReasons?: readonly PowerDemandReason[];
}
