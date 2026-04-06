import { readdir, readFile } from 'node:fs/promises';

import { AtomicJsonWriter, GroupPathResolver } from '@lume-hub/persistence-group-files';

import type { Group, GroupCatalogFile, GroupOperationalSettings } from '../../domain/entities/Group.js';
import {
  DEFAULT_GROUP_CALENDAR_ACCESS_POLICY,
  DEFAULT_GROUP_OPERATIONAL_SETTINGS,
} from '../../domain/entities/Group.js';

interface PersistedGroupFile extends Group {
  readonly schemaVersion: 1;
}

export interface GroupRepositoryConfig {
  readonly pathResolver: GroupPathResolver;
  readonly groupSeedFilePath?: string;
}

export class GroupRepository {
  constructor(
    private readonly config: GroupRepositoryConfig,
    private readonly writer = new AtomicJsonWriter(),
  ) {}

  async listGroups(): Promise<readonly Group[]> {
    const seedGroups = await this.readSeedGroups();
    const persistedGroups = await this.readPersistedGroups();
    const merged = new Map<string, Group>();

    for (const group of seedGroups) {
      merged.set(group.groupJid, normaliseGroup(group));
    }

    for (const group of persistedGroups) {
      const existing = merged.get(group.groupJid);
      merged.set(group.groupJid, existing ? mergeGroups(existing, group) : normaliseGroup(group));
    }

    return [...merged.values()].sort((left, right) => left.preferredSubject.localeCompare(right.preferredSubject));
  }

  async findByJid(groupJid: string): Promise<Group | undefined> {
    return (await this.listGroups()).find((group) => group.groupJid === groupJid);
  }

  async saveGroup(group: Group): Promise<Group> {
    const persistedGroup: PersistedGroupFile = {
      schemaVersion: 1,
      ...normaliseGroup(group),
    };

    await this.writer.write(this.config.pathResolver.resolveGroupMetadataPath(group.groupJid), persistedGroup);
    return persistedGroup;
  }

  async saveGroups(groups: readonly Group[]): Promise<readonly Group[]> {
    const persisted: Group[] = [];

    for (const group of groups) {
      persisted.push(await this.saveGroup(group));
    }

    return persisted;
  }

  private async readSeedGroups(): Promise<readonly Group[]> {
    if (!this.config.groupSeedFilePath) {
      return [];
    }

    try {
      const contents = await readFile(this.config.groupSeedFilePath, 'utf8');
      const file = JSON.parse(contents) as GroupCatalogFile;
      return file.groups.map((group) => normaliseGroup(group));
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  private async readPersistedGroups(): Promise<readonly Group[]> {
    try {
      const entries = await readdir(this.config.pathResolver.resolveGroupsRootPath(), {
        withFileTypes: true,
      });
      const groups: Group[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const metadataPath = this.config.pathResolver.resolveGroupMetadataPath(entry.name);

        try {
          const contents = await readFile(metadataPath, 'utf8');
          const value = JSON.parse(contents) as PersistedGroupFile;
          groups.push(normaliseGroup(value));
        } catch (error) {
          if (isNodeError(error) && error.code === 'ENOENT') {
            continue;
          }

          throw error;
        }
      }

      return groups;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }
}

function mergeGroups(seed: Group, persisted: Group): Group {
  return normaliseGroup({
    ...seed,
    ...persisted,
    aliases: [...seed.aliases, ...persisted.aliases],
    // Persisted owners are operator-managed state and must override seed owners.
    groupOwners: persisted.groupOwners,
    calendarAccessPolicy: {
      ...seed.calendarAccessPolicy,
      ...persisted.calendarAccessPolicy,
    },
    operationalSettings: {
      ...seed.operationalSettings,
      ...persisted.operationalSettings,
    },
  });
}

function normaliseGroup(group: Group): Group {
  return {
    groupJid: group.groupJid,
    preferredSubject: group.preferredSubject.trim(),
    aliases: [...new Set((group.aliases ?? []).map((alias) => alias.trim()).filter(Boolean))],
    courseId: group.courseId?.trim() || null,
    groupOwners: dedupeOwners(group.groupOwners ?? []),
    calendarAccessPolicy: {
      group: group.calendarAccessPolicy?.group ?? DEFAULT_GROUP_CALENDAR_ACCESS_POLICY.group,
      groupOwner: group.calendarAccessPolicy?.groupOwner ?? DEFAULT_GROUP_CALENDAR_ACCESS_POLICY.groupOwner,
      appOwner: group.calendarAccessPolicy?.appOwner ?? DEFAULT_GROUP_CALENDAR_ACCESS_POLICY.appOwner,
    },
    operationalSettings: normaliseOperationalSettings(group.operationalSettings),
    lastRefreshedAt: group.lastRefreshedAt ?? null,
  };
}

function normaliseOperationalSettings(settings: Group['operationalSettings'] | undefined): GroupOperationalSettings {
  const mode = settings?.mode ?? DEFAULT_GROUP_OPERATIONAL_SETTINGS.mode;
  const schedulingEnabled =
    mode === 'com_agendamento'
      ? settings?.schedulingEnabled ?? DEFAULT_GROUP_OPERATIONAL_SETTINGS.schedulingEnabled
      : false;
  const allowLlmScheduling =
    schedulingEnabled && mode === 'com_agendamento'
      ? settings?.allowLlmScheduling ?? DEFAULT_GROUP_OPERATIONAL_SETTINGS.allowLlmScheduling
      : false;

  return {
    mode,
    schedulingEnabled,
    allowLlmScheduling,
    memberTagPolicy: settings?.memberTagPolicy ?? DEFAULT_GROUP_OPERATIONAL_SETTINGS.memberTagPolicy,
  };
}

function dedupeOwners(owners: readonly Group['groupOwners'][number][]): readonly Group['groupOwners'][number][] {
  const entries = new Map<string, Group['groupOwners'][number]>();

  for (const owner of owners) {
    entries.set(owner.personId, {
      personId: owner.personId,
      assignedAt: owner.assignedAt,
      assignedBy: owner.assignedBy ?? null,
    });
  }

  return [...entries.values()];
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
