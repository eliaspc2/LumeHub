import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import type { AutostartPolicy } from '../../domain/entities/AutostartPolicy.js';

export interface AutostartStatus {
  readonly enabled: boolean;
  readonly manifestPath: string;
  readonly serviceName: string;
}

export interface AutostartInstallerConfig {
  readonly systemdUserPath: string;
}

export class AutostartInstaller {
  constructor(private readonly config: AutostartInstallerConfig) {}

  getSystemdUserPath(): string {
    return this.config.systemdUserPath;
  }

  async install(policy: AutostartPolicy): Promise<void> {
    await mkdir(this.config.systemdUserPath, { recursive: true });
    await writeTextFileAtomically(policy.manifestPath, renderUnitFile(policy));
  }

  async remove(policy: Pick<AutostartPolicy, 'manifestPath'>): Promise<void> {
    await rm(policy.manifestPath, { force: true });
  }

  async getStatus(policy: Pick<AutostartPolicy, 'manifestPath' | 'serviceName'>): Promise<AutostartStatus> {
    try {
      await readFile(policy.manifestPath, 'utf8');
      return {
        enabled: true,
        manifestPath: policy.manifestPath,
        serviceName: policy.serviceName,
      };
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return {
          enabled: false,
          manifestPath: policy.manifestPath,
          serviceName: policy.serviceName,
        };
      }

      throw error;
    }
  }
}

function renderUnitFile(policy: AutostartPolicy): string {
  const authFile = escapeSystemdValue(policy.codexAuthFile);

  return [
    '[Unit]',
    'Description=Lume Hub Host Companion',
    'After=network-online.target',
    'Wants=network-online.target',
    '',
    '[Service]',
    'Type=simple',
    `WorkingDirectory=${policy.workingDirectory}`,
    `Environment=CODEX_AUTH_FILE=${authFile}`,
    `ExecStart=${policy.execStart}`,
    'Restart=always',
    'RestartSec=5',
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n');
}

function escapeSystemdValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\s/g, '\\x20');
}

async function writeTextFileAtomically(filePath: string, value: string): Promise<void> {
  const directoryPath = dirname(filePath);
  await mkdir(directoryPath, { recursive: true });

  const temporaryPath = join(directoryPath, `${basename(filePath)}.${randomUUID()}.tmp`);
  await writeFile(temporaryPath, value, 'utf8');
  await rename(temporaryPath, filePath);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
