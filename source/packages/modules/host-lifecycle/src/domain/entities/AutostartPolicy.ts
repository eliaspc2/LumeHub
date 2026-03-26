export interface AutostartPolicy {
  readonly enabled: boolean;
  readonly serviceName: string;
  readonly manifestPath: string;
  readonly workingDirectory: string;
  readonly execStart: string;
  readonly codexAuthFile: string;
  readonly installedAt: string | null;
  readonly updatedAt: string;
}
