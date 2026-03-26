import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import type {
  HostCodexAuthRouterSnapshot,
  HostCompanionStatus,
  HostPowerStatusSnapshot,
} from '../../domain/entities/HostCompanionStatus.js';
import { HostLifecycleService } from './HostLifecycleService.js';

export interface HostCompanionCoordinatorConfig {
  readonly backendStateFilePath: string;
  readonly powerStatusProvider?: () => Promise<HostPowerStatusSnapshot | undefined>;
  readonly authRouterStatusProvider?: () => Promise<HostCodexAuthRouterSnapshot | undefined>;
}

export class HostCompanionCoordinator {
  constructor(
    private readonly service: HostLifecycleService,
    private readonly config: HostCompanionCoordinatorConfig,
  ) {}

  async publishHeartbeat(input: { readonly now?: Date; readonly lastError?: string | null } = {}): Promise<HostCompanionStatus> {
    await this.service.recordHeartbeat(input);
    const status = await this.service.getHostCompanionStatus();
    const power = await this.config.powerStatusProvider?.();
    const authRouter = await this.config.authRouterStatusProvider?.();

    const snapshot: HostCompanionStatus = {
      ...status,
      power,
      authRouter,
    };

    await writeJsonFileAtomically(this.config.backendStateFilePath, snapshot);
    return snapshot;
  }
}

async function writeJsonFileAtomically(filePath: string, value: unknown): Promise<void> {
  const directoryPath = dirname(filePath);
  await mkdir(directoryPath, { recursive: true });

  const temporaryPath = join(directoryPath, `${basename(filePath)}.${randomUUID()}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);
}
