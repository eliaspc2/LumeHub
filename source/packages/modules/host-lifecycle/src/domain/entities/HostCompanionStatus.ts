export interface HostPowerStatusSnapshot {
  readonly policyMode: string;
  readonly inhibitorActive: boolean;
  readonly leaseId: string | null;
  readonly explanation: string;
}

export interface HostCodexAuthRouterSnapshot {
  readonly canonicalAuthFilePath: string;
  readonly currentAccountId: string | null;
  readonly currentSourceFilePath: string | null;
  readonly accountCount: number;
  readonly lastSwitchAt: string | null;
}

export interface HostCompanionStatus {
  readonly schemaVersion: 1;
  readonly hostId: string;
  readonly auth: {
    readonly filePath: string;
    readonly exists: boolean;
    readonly sameAsCodexCanonical: boolean;
  };
  readonly autostart: {
    readonly enabled: boolean;
    readonly serviceName: string;
    readonly manifestPath: string;
    readonly workingDirectory: string;
    readonly execStart: string;
    readonly installedAt: string | null;
  };
  readonly runtime: {
    readonly stateFilePath: string;
    readonly backendStateFilePath: string;
    readonly lastRepairAt: string | null;
    readonly lastHeartbeatAt: string | null;
    readonly updatedAt: string;
    readonly lastError: string | null;
  };
  readonly power?: HostPowerStatusSnapshot;
  readonly authRouter?: HostCodexAuthRouterSnapshot;
}
