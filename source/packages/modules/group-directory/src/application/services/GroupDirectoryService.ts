import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { GroupPathResolver } from '@lume-hub/persistence-group-files';

import type {
  Group,
  GroupCalendarAccessPolicy,
  GroupKnowledgeWorkspaceDescriptor,
  GroupLlmInstructionsDocument,
  GroupOperationalSettings,
  GroupOperationalSettingsUpdate,
  GroupOwnerAssignmentInput,
  GroupOwnerAssignment,
  GroupPolicyDocument,
  GroupWorkspaceDescriptor,
  WhatsAppGroupSnapshot,
} from '../../domain/entities/Group.js';
import {
  DEFAULT_GROUP_CALENDAR_ACCESS_POLICY,
  DEFAULT_GROUP_OPERATIONAL_SETTINGS,
} from '../../domain/entities/Group.js';
import { GroupRepository } from '../../infrastructure/persistence/GroupRepository.js';

export class GroupDirectoryService {
  constructor(
    private readonly repository: GroupRepository,
    private readonly pathResolver: GroupPathResolver,
  ) {}

  async listGroups(): Promise<readonly Group[]> {
    return this.repository.listGroups();
  }

  async findByJid(groupJid: string): Promise<Group | undefined> {
    return this.repository.findByJid(groupJid);
  }

  async findBySubject(subject: string): Promise<Group | undefined> {
    const normalisedSubject = normaliseKey(subject);
    return (await this.listGroups()).find((group) => normaliseKey(group.preferredSubject) === normalisedSubject);
  }

  async findByAlias(alias: string): Promise<Group | undefined> {
    const normalisedAlias = normaliseKey(alias);
    return (await this.listGroups()).find((group) =>
      group.aliases.some((candidate) => normaliseKey(candidate) === normalisedAlias),
    );
  }

  async refreshFromWhatsApp(snapshots: readonly WhatsAppGroupSnapshot[], now = new Date()): Promise<readonly Group[]> {
    const currentGroups = new Map((await this.listGroups()).map((group) => [group.groupJid, group]));
    const refreshed: Group[] = [];

    for (const snapshot of snapshots) {
      const existing = currentGroups.get(snapshot.groupJid);
      const updatedGroup: Group = {
        groupJid: snapshot.groupJid,
        preferredSubject: snapshot.subject.trim(),
        aliases: [
          ...(existing?.aliases ?? []),
          ...(snapshot.aliases ?? []),
          ...(existing && existing.preferredSubject !== snapshot.subject ? [existing.preferredSubject] : []),
        ],
        courseId: existing?.courseId ?? null,
        groupOwners: existing?.groupOwners ?? [],
        calendarAccessPolicy: existing?.calendarAccessPolicy ?? DEFAULT_GROUP_CALENDAR_ACCESS_POLICY,
        operationalSettings: existing?.operationalSettings ?? DEFAULT_GROUP_OPERATIONAL_SETTINGS,
        lastRefreshedAt: now.toISOString(),
      };

      refreshed.push(await this.repository.saveGroup(updatedGroup));
    }

    return refreshed;
  }

  async getGroupOwners(groupJid: string): Promise<readonly GroupOwnerAssignment[]> {
    return (await this.findRequiredGroup(groupJid)).groupOwners;
  }

  async replaceGroupOwners(
    groupJid: string,
    owners: readonly GroupOwnerAssignmentInput[],
    now = new Date(),
  ): Promise<readonly GroupOwnerAssignment[]> {
    const group = await this.findRequiredGroup(groupJid);
    const nextGroup: Group = {
      ...group,
      groupOwners: owners
        .map((owner) => ({
          personId: owner.personId.trim(),
          assignedAt: owner.assignedAt ?? now.toISOString(),
          assignedBy: owner.assignedBy ?? null,
        }))
        .filter((owner) => owner.personId.length > 0),
    };

    return (await this.repository.saveGroup(nextGroup)).groupOwners;
  }

  async isGroupOwner(groupJid: string, personId: string): Promise<boolean> {
    return (await this.getGroupOwners(groupJid)).some((owner) => owner.personId === personId);
  }

  async getCalendarAccessPolicy(groupJid: string): Promise<GroupCalendarAccessPolicy> {
    return (await this.findRequiredGroup(groupJid)).calendarAccessPolicy;
  }

  async getOperationalSettings(groupJid: string): Promise<GroupOperationalSettings> {
    return (await this.findRequiredGroup(groupJid)).operationalSettings;
  }

  async updateCalendarAccessPolicy(
    groupJid: string,
    update: Partial<GroupCalendarAccessPolicy>,
  ): Promise<GroupCalendarAccessPolicy> {
    const group = await this.findRequiredGroup(groupJid);
    const nextGroup: Group = {
      ...group,
      calendarAccessPolicy: {
        ...group.calendarAccessPolicy,
        ...update,
      },
    };

    return (await this.repository.saveGroup(nextGroup)).calendarAccessPolicy;
  }

  async updateOperationalSettings(
    groupJid: string,
    update: GroupOperationalSettingsUpdate,
  ): Promise<GroupOperationalSettings> {
    const group = await this.findRequiredGroup(groupJid);
    const nextGroup: Group = {
      ...group,
      operationalSettings: normaliseOperationalSettings({
        ...group.operationalSettings,
        ...update,
      }),
    };

    return (await this.repository.saveGroup(nextGroup)).operationalSettings;
  }

  async getGroupWorkspace(groupJid: string): Promise<GroupWorkspaceDescriptor> {
    await this.findRequiredGroup(groupJid);

    return {
      rootPath: this.pathResolver.resolveGroupRootPath(groupJid),
      llmRootPath: this.pathResolver.resolveGroupLlmRootPath(groupJid),
      llmInstructionsPath: this.pathResolver.resolveGroupLlmInstructionsPath(groupJid),
      knowledgeRootPath: this.pathResolver.resolveGroupKnowledgeRootPath(groupJid),
      knowledgeIndexPath: this.pathResolver.resolveGroupKnowledgeIndexPath(groupJid),
      policyPath: this.pathResolver.resolveGroupPolicyPath(groupJid),
      calendarDirectoryPath: this.pathResolver.resolveGroupCalendarDirectoryPath(groupJid),
    };
  }

  async getGroupKnowledgeWorkspace(groupJid: string): Promise<GroupKnowledgeWorkspaceDescriptor> {
    const workspace = await this.getGroupWorkspace(groupJid);

    return {
      rootPath: workspace.knowledgeRootPath,
      indexPath: workspace.knowledgeIndexPath,
    };
  }

  async getGroupLlmInstructions(groupJid: string): Promise<GroupLlmInstructionsDocument> {
    const workspace = await this.getGroupWorkspace(groupJid);

    try {
      return {
        primaryFilePath: workspace.llmInstructionsPath,
        resolvedFilePath: workspace.llmInstructionsPath,
        exists: true,
        source: 'llm_instructions',
        content: await readFile(workspace.llmInstructionsPath, 'utf8'),
      };
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    }

    return {
      primaryFilePath: workspace.llmInstructionsPath,
      resolvedFilePath: null,
      exists: false,
      source: 'missing',
      content: null,
    };
  }

  async updateGroupLlmInstructions(
    groupJid: string,
    input: { readonly content: string },
  ): Promise<GroupLlmInstructionsDocument> {
    const workspace = await this.getGroupWorkspace(groupJid);
    await mkdir(dirname(workspace.llmInstructionsPath), { recursive: true });
    await writeFile(workspace.llmInstructionsPath, ensureTrailingNewline(input.content), 'utf8');
    return this.getGroupLlmInstructions(groupJid);
  }

  async getGroupPolicy(groupJid: string): Promise<GroupPolicyDocument> {
    const workspace = await this.getGroupWorkspace(groupJid);

    try {
      return {
        filePath: workspace.policyPath,
        exists: true,
        value: JSON.parse(await readFile(workspace.policyPath, 'utf8')) as Record<string, unknown>,
      };
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return {
          filePath: workspace.policyPath,
          exists: false,
          value: null,
        };
      }

      throw error;
    }
  }

  async updateGroupPolicy(
    groupJid: string,
    input: { readonly value: Record<string, unknown> },
  ): Promise<GroupPolicyDocument> {
    const workspace = await this.getGroupWorkspace(groupJid);
    await mkdir(dirname(workspace.policyPath), { recursive: true });
    await writeFile(
      workspace.policyPath,
      ensureTrailingNewline(JSON.stringify(input.value, null, 2)),
      'utf8',
    );
    return this.getGroupPolicy(groupJid);
  }

  private async findRequiredGroup(groupJid: string): Promise<Group> {
    const group = await this.findByJid(groupJid);

    if (!group) {
      throw new Error(`Unknown group '${groupJid}'.`);
    }

    return group;
  }
}

function normaliseKey(value: string): string {
  return value.trim().toLowerCase();
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function ensureTrailingNewline(value: string): string {
  const trimmed = value.replace(/\r\n/gu, '\n');
  return trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`;
}

function normaliseOperationalSettings(
  settings: Partial<GroupOperationalSettings> | undefined,
): GroupOperationalSettings {
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
