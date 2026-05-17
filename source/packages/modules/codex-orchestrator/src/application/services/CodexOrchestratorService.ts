import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import type { AdminConfigModuleContract, AutomationDefinition } from '@lume-hub/admin-config';
import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { PeopleMemoryModuleContract } from '@lume-hub/people-memory';
import type { ScheduleEventsModuleContract } from '@lume-hub/schedule-events';

import type {
  CodexOrchestratorPaths,
  CodexOrchestratorStatus,
  CreateAutomationInput,
  CreateScheduleEventInput,
  CreateWeeklyAutomationInput,
  LockdownResult,
  SyncAdminResult,
  UpsertGroupPromptInput,
} from '../../domain/entities/CodexOrchestrator.js';

const ADMIN_PERSON_ID = 'app-owner-whatsapp-admin';

export class CodexOrchestratorService {
  constructor(
    private readonly paths: CodexOrchestratorPaths,
    private readonly adminConfig: Pick<
      AdminConfigModuleContract,
      'getSettings' | 'updateCommandsSettings' | 'updateAutomationSettings'
    >,
    private readonly peopleMemory: Pick<
      PeopleMemoryModuleContract,
      'findByIdentifiers' | 'upsertByIdentifiers' | 'isAppOwner'
    >,
    private readonly groupDirectory: Pick<
      GroupDirectoryModuleContract,
      'listGroups' | 'findByJid' | 'getGroupLlmInstructions' | 'updateGroupLlmInstructions'
    >,
    private readonly scheduleEvents: Pick<ScheduleEventsModuleContract, 'createEvent'>,
  ) {}

  async status(): Promise<CodexOrchestratorStatus> {
    const [settings, groups, adminJid] = await Promise.all([
      this.adminConfig.getSettings(),
      this.groupDirectory.listGroups(),
      this.readAdminJid().catch(() => null),
    ]);
    const adminPerson = adminJid
      ? await this.peopleMemory.findByIdentifiers([{ kind: 'whatsapp_jid', value: adminJid }])
      : null;
    const groupRows = [];

    for (const group of groups) {
      const instructions = await this.groupDirectory.getGroupLlmInstructions(group.groupJid);
      groupRows.push({
        groupJid: group.groupJid,
        preferredSubject: group.preferredSubject,
        schedulingEnabled: group.operationalSettings.schedulingEnabled,
        mode: group.operationalSettings.mode,
        promptExists: instructions.exists,
      });
    }

    return {
      paths: this.paths,
      admin: {
        phoneFilePath: this.paths.adminPhoneFilePath,
        configuredJid: adminJid,
        personId: adminPerson?.personId ?? null,
        appOwner: adminPerson ? await this.peopleMemory.isAppOwner(adminPerson.personId) : false,
      },
      policy: {
        assistantEnabled: settings.commands.assistantEnabled,
        schedulingEnabled: settings.commands.schedulingEnabled,
        autoReplyEnabled: settings.commands.autoReplyEnabled,
        directRepliesEnabled: settings.commands.directRepliesEnabled,
        allowPrivateAssistant: settings.commands.allowPrivateAssistant,
        authorizedPrivateJids: settings.commands.authorizedPrivateJids,
        authorizedGroupJids: settings.commands.authorizedGroupJids,
      },
      groups: groupRows,
      automations: settings.automations.definitions.map((definition) => ({
        automationId: definition.automationId,
        groupJid: definition.groupJid,
        groupLabel: definition.groupLabel,
        enabled: definition.enabled,
        schedule: definition.schedule,
        messageTemplate: definition.messageTemplate,
      })),
    };
  }

  async syncAdminFromPhoneFile(phoneFilePath = this.paths.adminPhoneFilePath): Promise<SyncAdminResult> {
    const adminJid = await this.readAdminJid(phoneFilePath);
    const existing = await this.peopleMemory.findByIdentifiers([{ kind: 'whatsapp_jid', value: adminJid }]);
    const adminPerson = await this.peopleMemory.upsertByIdentifiers({
      personId: existing?.personId ?? ADMIN_PERSON_ID,
      displayName: existing?.displayName ?? 'Admin WhatsApp',
      identifiers: dedupeIdentifiers([
        ...(existing?.identifiers ?? []),
        { kind: 'whatsapp_jid', value: adminJid },
      ]),
      globalRoles: ['app_owner'],
    });
    const settings = await this.adminConfig.getSettings();
    const authorizedPrivateJids = dedupe([...settings.commands.authorizedPrivateJids, adminJid]);

    await this.adminConfig.updateCommandsSettings({
      assistantEnabled: true,
      schedulingEnabled: true,
      ownerTerminalEnabled: true,
      allowPrivateAssistant: true,
      authorizedPrivateJids,
    });

    return {
      adminJid,
      personId: adminPerson.personId,
      authorizedPrivateJids,
    };
  }

  async lockdownToAdminAndScheduledGroups(): Promise<LockdownResult> {
    const settings = await this.adminConfig.getSettings();
    const adminJid = await this.readAdminJid().catch(() => null);
    const groups = await this.groupDirectory.listGroups();
    const authorizedGroupJids = groups
      .filter((group) => group.operationalSettings.mode === 'com_agendamento')
      .filter((group) => group.operationalSettings.schedulingEnabled)
      .map((group) => group.groupJid);
    const authorizedPrivateJids = adminJid
      ? dedupe([adminJid])
      : dedupe(settings.commands.authorizedPrivateJids);

    await this.adminConfig.updateCommandsSettings({
      assistantEnabled: true,
      schedulingEnabled: true,
      ownerTerminalEnabled: true,
      autoReplyEnabled: true,
      directRepliesEnabled: false,
      allowPrivateAssistant: true,
      authorizedPrivateJids,
      authorizedGroupJids,
    });

    return {
      authorizedPrivateJids,
      authorizedGroupJids,
    };
  }

  async upsertGroupPrompt(input: UpsertGroupPromptInput): Promise<{ readonly groupJid: string; readonly promptPath: string }> {
    await this.requireGroup(input.groupJid);
    const document = await this.groupDirectory.updateGroupLlmInstructions(input.groupJid, {
      content: input.content,
    });

    return {
      groupJid: input.groupJid,
      promptPath: document.primaryFilePath,
    };
  }

  async createScheduleEvent(input: CreateScheduleEventInput) {
    const group = await this.requireGroup(input.groupJid);

    return this.scheduleEvents.createEvent({
      groupJid: group.groupJid,
      groupLabel: group.preferredSubject,
      title: input.title,
      eventAt: input.eventAt,
      metadata: {
        source: 'codex-orchestrator',
        message: input.message?.trim() || null,
      },
    });
  }

  async createAutomation(input: CreateAutomationInput): Promise<{ readonly automationId: string }> {
    const group = await this.requireGroup(input.groupJid);
    const settings = await this.adminConfig.getSettings();
    const automationId = `codex-${randomUUID()}`;
    const definition: AutomationDefinition = {
      automationId,
      entryId: automationId,
      enabled: true,
      groupJid: group.groupJid,
      groupLabel: group.preferredSubject,
      schedule: input.schedule,
      notifyBeforeMinutes: input.notifyBeforeMinutes ?? [0],
      messageTemplate: input.messageTemplate.trim(),
      actions: [{ type: 'wa_send', textTemplate: input.messageTemplate.trim() }],
      importedFrom: 'codex-orchestrator',
    };

    await this.adminConfig.updateAutomationSettings({
      enabled: true,
      definitions: [...settings.automations.definitions, definition],
    });

    return { automationId };
  }

  async createWeeklyAutomation(input: CreateWeeklyAutomationInput): Promise<{ readonly automationId: string }> {
    return this.createAutomation({
      groupJid: input.groupJid,
      schedule: {
        type: 'weekly',
        daysOfWeek: input.daysOfWeek,
        time: input.time,
      },
      messageTemplate: input.messageTemplate,
      notifyBeforeMinutes: input.notifyBeforeMinutes,
    });
  }

  private async readAdminJid(phoneFilePath = this.paths.adminPhoneFilePath): Promise<string> {
    return normaliseWhatsAppPhoneToJid(await readFile(phoneFilePath, 'utf8'));
  }

  private async requireGroup(groupJid: string) {
    const group = await this.groupDirectory.findByJid(groupJid.trim());
    if (!group) {
      throw new Error(`Unknown group: ${groupJid}`);
    }

    return group;
  }
}

export function normaliseWhatsAppPhoneToJid(input: string): string {
  const firstLine = input
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#'));

  if (!firstLine) {
    throw new Error('Admin phone file is empty.');
  }

  if (firstLine.includes('@')) {
    return firstLine.replace(/:\d+(?=@)/u, '').toLowerCase();
  }

  const digits = firstLine.replace(/[^\d]/gu, '');
  if (digits.length < 8) {
    throw new Error('Admin phone number must contain at least 8 digits.');
  }

  return `${digits}@s.whatsapp.net`;
}

function dedupe(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function dedupeIdentifiers(
  values: readonly { readonly kind: string; readonly value: string }[],
): readonly { readonly kind: string; readonly value: string }[] {
  const seen = new Set<string>();
  const output = [];

  for (const value of values) {
    const key = `${value.kind}:${value.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      output.push(value);
    }
  }

  return output;
}
