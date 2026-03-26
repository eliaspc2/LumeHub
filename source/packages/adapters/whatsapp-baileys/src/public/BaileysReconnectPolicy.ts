export interface BaileysReconnectPolicyOptions {
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
}

export class BaileysReconnectPolicy {
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(options: BaileysReconnectPolicyOptions = {}) {
    this.baseDelayMs = options.baseDelayMs ?? 1_000;
    this.maxDelayMs = options.maxDelayMs ?? 30_000;
  }

  nextDelayMs(retryCount: number): number {
    return Math.min(this.baseDelayMs * (2 ** Math.max(0, retryCount)), this.maxDelayMs);
  }
}
