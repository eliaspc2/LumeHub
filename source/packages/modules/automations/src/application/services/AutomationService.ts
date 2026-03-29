import { readFile } from 'node:fs/promises';

import { SystemClock, type Clock } from '@lume-hub/clock';
import type {
  AdminConfigModuleContract,
  AutomationAction,
  AutomationDefinition,
  AutomationSchedule,
  AutomationWeekdayToken,
} from '@lume-hub/admin-config';
import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';

import type {
  AutomationTickResult,
  LegacyAutomationImportDefinitionReport,
  LegacyAutomationImportReport,
} from '../../domain/entities/Automation.js';
import { AutomationFiredStateRepository } from '../../infrastructure/persistence/AutomationFiredStateRepository.js';
import { AutomationRunRepository } from '../../infrastructure/persistence/AutomationRunRepository.js';

interface LegacyAutomationsFile {
  readonly groups?: readonly {
    readonly name?: string;
    readonly entries?: readonly {
      readonly id?: string;
      readonly type?: 'weekly' | 'oneShot';
      readonly daysOfWeek?: readonly AutomationWeekdayToken[];
      readonly time?: string;
      readonly startsAt?: string;
      readonly notifyBeforeMinutes?: readonly number[];
      readonly messageTemplate?: string;
      readonly actions?: readonly (
        | { readonly type?: 'log' }
        | { readonly type?: 'webhook'; readonly url?: string; readonly method?: 'POST' | 'PUT'; readonly headers?: Record<string, string> }
        | { readonly type?: 'wa_send'; readonly textTemplate?: string }
      )[];
    }[];
  }[];
}

type LegacyAutomationGroup = NonNullable<LegacyAutomationsFile['groups']>[number];
type LegacyAutomationEntry = NonNullable<LegacyAutomationGroup['entries']>[number];
type LegacyAutomationActionInput = NonNullable<LegacyAutomationEntry['actions']>[number];

export interface AutomationSendRuntime {
  sendText(input: {
    readonly chatJid: string;
    readonly text: string;
    readonly idempotencyKey?: string;
    readonly messageId?: string;
  }): Promise<{
    readonly messageId: string;
    readonly acceptedAt: string;
  }>;
}

export interface AutomationServiceConfig {
  readonly adminConfig: Pick<AdminConfigModuleContract, 'getSettings' | 'updateAutomationSettings'>;
  readonly groupDirectory: Pick<GroupDirectoryModuleContract, 'listGroups'>;
  readonly legacyAutomationsFilePath: string;
  readonly runRepository: AutomationRunRepository;
  readonly firedStateRepository: AutomationFiredStateRepository;
  readonly fetchImpl?: typeof fetch;
  readonly clock?: Clock;
}

export class AutomationService {
  private readonly fetchImpl: typeof fetch;
  private readonly clock: Clock;

  constructor(private readonly config: AutomationServiceConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.clock = config.clock ?? new SystemClock();
  }

  async listDefinitions(): Promise<readonly AutomationDefinition[]> {
    return (await this.config.adminConfig.getSettings()).automations.definitions;
  }

  async listRecentRuns(limit = 20) {
    const log = await this.config.runRepository.read();
    return log.runs.slice(Math.max(0, log.runs.length - limit)).reverse();
  }

  async previewLegacyImport(): Promise<LegacyAutomationImportReport> {
    return this.importLegacy('preview');
  }

  async applyLegacyImport(): Promise<LegacyAutomationImportReport> {
    return this.importLegacy('apply');
  }

  async tick(sendRuntime: AutomationSendRuntime, now = this.clock.now()): Promise<AutomationTickResult> {
    const settings = await this.config.adminConfig.getSettings();

    if (!settings.automations.enabled) {
      return {
        executedCount: 0,
        failedCount: 0,
        runs: [],
      };
    }

    const state = await this.config.firedStateRepository.read();
    const nextFired = {
      ...state.fired,
    };
    const executedRuns = [];
    let failedCount = 0;

    for (const definition of settings.automations.definitions) {
      if (!definition.enabled) {
        continue;
      }

      const startsAt = resolveNextOccurrence(now, definition.schedule);

      if (!startsAt) {
        continue;
      }

      const startsAtMs = startsAt.getTime();

      if (definition.schedule.type === 'one_shot' && startsAtMs < now.getTime() - 60_000) {
        continue;
      }

      for (const offsetMinutes of definition.notifyBeforeMinutes) {
        const fireAtMs = startsAtMs - offsetMinutes * 60_000;

        if (fireAtMs > now.getTime()) {
          continue;
        }

        if (now.getTime() - fireAtMs > settings.automations.fireWindowMinutes * 60_000) {
          continue;
        }

        const firedKey = `${definition.automationId}:${startsAtMs}:${offsetMinutes}`;

        if (nextFired[firedKey]) {
          continue;
        }

        try {
          const run = await this.executeDefinition({
            definition,
            offsetMinutes,
            startsAt,
            now,
            sendRuntime,
          });
          executedRuns.push(run);
          nextFired[firedKey] = run.firedAt;
          await this.config.runRepository.append(run);
        } catch (error) {
          failedCount += 1;
          const failedRun = buildFailedRun(definition, offsetMinutes, startsAt, now, error);
          executedRuns.push(failedRun);
          await this.config.runRepository.append(failedRun);
        }
      }
    }

    await this.config.firedStateRepository.save({
      fired: nextFired,
    });

    return {
      executedCount: executedRuns.filter((run) => run.status === 'executed').length,
      failedCount,
      runs: executedRuns,
    };
  }

  private async importLegacy(mode: 'preview' | 'apply'): Promise<LegacyAutomationImportReport> {
    const legacy = JSON.parse(await readFile(this.config.legacyAutomationsFilePath, 'utf8')) as LegacyAutomationsFile;
    const groups = await this.config.groupDirectory.listGroups();
    const groupsByLabel = new Map(groups.map((group) => [group.preferredSubject, group]));
    const definitions: AutomationDefinition[] = [];
    const missingGroups = new Map<string, string[]>();

    for (const legacyGroup of legacy.groups ?? []) {
      const groupName = legacyGroup.name?.trim();

      if (!groupName) {
        continue;
      }

      const targetGroup = groupsByLabel.get(groupName);

      if (!targetGroup) {
        missingGroups.set(
          groupName,
          (legacyGroup.entries ?? []).map((entry) => entry.id?.trim()).filter((value): value is string => Boolean(value)),
        );
        continue;
      }

      for (const entry of legacyGroup.entries ?? []) {
        const definition = toAutomationDefinition(entry, targetGroup.groupJid, targetGroup.preferredSubject, this.config.legacyAutomationsFilePath);

        if (definition) {
          definitions.push(definition);
        }
      }
    }

    if (mode === 'apply') {
      await this.config.adminConfig.updateAutomationSettings({
        enabled: true,
        definitions,
      });
    }

    return {
      mode,
      sourceFilePath: this.config.legacyAutomationsFilePath,
      totals: {
        legacyGroups: legacy.groups?.length ?? 0,
        legacyEntries: (legacy.groups ?? []).reduce((sum, group) => sum + (group.entries?.length ?? 0), 0),
        importedDefinitions: definitions.length,
        missingGroups: missingGroups.size,
      },
      missingGroups: [...missingGroups.entries()].map(([groupLabel, entryIds]) => ({
        groupLabel,
        entryIds,
      })),
      definitions: definitions.map(describeDefinition),
      importedDefinitionsSnapshot: definitions,
    };
  }

  private async executeDefinition(input: {
    readonly definition: AutomationDefinition;
    readonly offsetMinutes: number;
    readonly startsAt: Date;
    readonly now: Date;
    readonly sendRuntime: AutomationSendRuntime;
  }) {
    const { definition, offsetMinutes, startsAt, now, sendRuntime } = input;
    const vars = {
      group: definition.groupLabel,
      id: definition.entryId,
      offsetMinutes,
      minutesLeft: Math.max(0, Math.round((startsAt.getTime() - now.getTime()) / 60_000)),
      time: `${String(startsAt.getHours()).padStart(2, '0')}:${String(startsAt.getMinutes()).padStart(2, '0')}`,
      datetime: startsAt.toISOString(),
    };
    const defaultText = definition.messageTemplate
      ? renderTemplate(definition.messageTemplate, vars)
      : `Lembrete (${definition.entryId}): em ${vars.minutesLeft} min (${vars.datetime})`;
    let waMessageId: string | null = null;
    let webhookDeliveries = 0;

    for (const action of definition.actions) {
      if (action.type === 'webhook') {
        await this.fetchImpl(action.url, {
          method: action.method ?? 'POST',
          headers: {
            'content-type': 'application/json',
            ...(action.headers ?? {}),
          },
          body: JSON.stringify({
            kind: 'automation',
            group: definition.groupLabel,
            jid: definition.groupJid,
            entryId: definition.entryId,
            startsAt: startsAt.toISOString(),
            offsetMinutes,
            text: defaultText,
          }),
        });
        webhookDeliveries += 1;
        continue;
      }

      if (action.type === 'wa_send') {
        const sendResult = await sendRuntime.sendText({
          chatJid: definition.groupJid,
          text: action.textTemplate ? renderTemplate(action.textTemplate, vars) : defaultText,
          idempotencyKey: `${definition.automationId}:${startsAt.toISOString()}:${offsetMinutes}`,
        });
        waMessageId = sendResult.messageId;
      }
    }

    return {
      runId: `${definition.automationId}:${startsAt.toISOString()}:${offsetMinutes}`,
      automationId: definition.automationId,
      entryId: definition.entryId,
      groupJid: definition.groupJid,
      groupLabel: definition.groupLabel,
      offsetMinutes,
      scheduledFor: startsAt.toISOString(),
      firedAt: now.toISOString(),
      text: defaultText,
      actionTypes: definition.actions.map((action) => action.type),
      waMessageId,
      webhookDeliveries,
      status: 'executed' as const,
      error: null,
    };
  }
}

function resolveNextOccurrence(now: Date, schedule: AutomationSchedule): Date | null {
  if (schedule.type === 'one_shot') {
    const milliseconds = Date.parse(schedule.startsAt);
    return Number.isFinite(milliseconds) ? new Date(milliseconds) : null;
  }

  const [hour, minute] = schedule.time.split(':').map((part) => Number(part));

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidateDate = new Date(now);
    candidateDate.setDate(now.getDate() + offset);
    const token = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][candidateDate.getDay()] as AutomationWeekdayToken;

    if (!schedule.daysOfWeek.includes(token)) {
      continue;
    }

    const candidate = new Date(
      candidateDate.getFullYear(),
      candidateDate.getMonth(),
      candidateDate.getDate(),
      hour,
      minute,
      0,
      0,
    );

    if (candidate.getTime() > now.getTime() - 5 * 60_000) {
      return candidate;
    }
  }

  return null;
}

function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gu, (_match, key) => String(vars[key] ?? ''));
}

function toAutomationDefinition(
  entry: LegacyAutomationEntry,
  groupJid: string,
  groupLabel: string,
  sourceFilePath: string,
): AutomationDefinition | null {
  const entryId = entry?.id?.trim();

  if (!entryId) {
    return null;
  }

  const schedule = toSchedule(entry);

  if (!schedule) {
    return null;
  }

  const actions = toActions(entry.actions);

  return {
    automationId: `${groupJid}:${entryId}`,
    entryId,
    enabled: true,
    groupJid,
    groupLabel,
    schedule,
    notifyBeforeMinutes: [
      ...new Set(
        (entry.notifyBeforeMinutes ?? [])
          .map((value: number) => Number(value))
          .filter((value: number) => Number.isInteger(value) && value >= 0),
      ),
    ].sort((left: number, right: number) => left - right),
    messageTemplate: entry.messageTemplate?.trim() || null,
    actions: actions.length > 0 ? actions : [{ type: 'log' }],
    importedFrom: sourceFilePath,
  };
}

function toSchedule(entry: LegacyAutomationEntry): AutomationSchedule | null {
  if (entry.type === 'weekly' && entry.daysOfWeek && entry.time) {
    return {
      type: 'weekly',
      daysOfWeek: entry.daysOfWeek,
      time: entry.time,
    };
  }

  if (entry.type === 'oneShot' && entry.startsAt) {
    return {
      type: 'one_shot',
      startsAt: entry.startsAt,
    };
  }

  return null;
}

function toActions(
  actions: readonly LegacyAutomationActionInput[] | undefined,
): readonly AutomationAction[] {
  return (actions ?? [])
    .map((action: LegacyAutomationActionInput): AutomationAction | null => {
      if (action?.type === 'webhook' && action.url?.trim()) {
        return {
          type: 'webhook',
          url: action.url.trim(),
          method: action.method ?? 'POST',
          headers: action.headers ?? {},
        };
      }

      if (action?.type === 'wa_send') {
        return {
          type: 'wa_send',
          textTemplate: action.textTemplate?.trim() || null,
        };
      }

      if (action?.type === 'log') {
        return {
          type: 'log',
        };
      }

      return null;
    })
    .filter((action: AutomationAction | null): action is AutomationAction => Boolean(action));
}

function describeDefinition(definition: AutomationDefinition): LegacyAutomationImportDefinitionReport {
  return {
    automationId: definition.automationId,
    entryId: definition.entryId,
    groupJid: definition.groupJid,
    groupLabel: definition.groupLabel,
    scheduleLabel:
      definition.schedule.type === 'weekly'
        ? `${definition.schedule.daysOfWeek.join(', ')} @ ${definition.schedule.time}`
        : definition.schedule.startsAt,
    actionLabels: definition.actions.map((action) => (action.type === 'webhook' ? `webhook ${action.url}` : action.type)),
  };
}

function buildFailedRun(definition: AutomationDefinition, offsetMinutes: number, startsAt: Date, now: Date, error: unknown) {
  return {
    runId: `${definition.automationId}:${startsAt.toISOString()}:${offsetMinutes}:failed`,
    automationId: definition.automationId,
    entryId: definition.entryId,
    groupJid: definition.groupJid,
    groupLabel: definition.groupLabel,
    offsetMinutes,
    scheduledFor: startsAt.toISOString(),
    firedAt: now.toISOString(),
    text: definition.messageTemplate ?? definition.entryId,
    actionTypes: definition.actions.map((action) => action.type),
    waMessageId: null,
    webhookDeliveries: 0,
    status: 'failed' as const,
    error: error instanceof Error ? error.message : String(error),
  };
}
