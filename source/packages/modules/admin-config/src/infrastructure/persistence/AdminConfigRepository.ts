import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

import type { AdminSettings } from '../../domain/entities/AdminConfig.js';
import { DEFAULT_ADMIN_SETTINGS } from '../../domain/entities/AdminConfig.js';

export interface AdminConfigRepositoryConfig {
  readonly settingsFilePath?: string;
}

export class AdminConfigRepository {
  private readonly settingsFilePath: string;

  constructor(
    config: AdminConfigRepositoryConfig = {},
    private readonly writer = new AtomicJsonWriter(),
  ) {
    this.settingsFilePath = config.settingsFilePath ?? resolve(process.cwd(), 'runtime/system/system-settings.json');
  }

  getSettingsFilePath(): string {
    return this.settingsFilePath;
  }

  async readSettings(): Promise<AdminSettings> {
    try {
      const raw = JSON.parse(await readFile(this.settingsFilePath, 'utf8')) as Partial<AdminSettings>;
      return normaliseSettings(raw);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return DEFAULT_ADMIN_SETTINGS;
      }

      throw error;
    }
  }

  async saveSettings(settings: AdminSettings): Promise<AdminSettings> {
    const normalised = normaliseSettings(settings);
    await this.writer.write(this.settingsFilePath, normalised);
    return normalised;
  }
}

function normaliseSettings(input: Partial<AdminSettings>): AdminSettings {
  return {
    schemaVersion: 1,
    commands: {
      ...DEFAULT_ADMIN_SETTINGS.commands,
      ...(input.commands ?? {}),
    },
    llm: {
      ...DEFAULT_ADMIN_SETTINGS.llm,
      ...(input.llm ?? {}),
    },
    ui: {
      ...DEFAULT_ADMIN_SETTINGS.ui,
      ...(input.ui ?? {}),
      defaultNotificationRules: Array.isArray(input.ui?.defaultNotificationRules)
        ? input.ui.defaultNotificationRules
        : DEFAULT_ADMIN_SETTINGS.ui.defaultNotificationRules,
    },
    updatedAt: input.updatedAt ?? DEFAULT_ADMIN_SETTINGS.updatedAt,
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
