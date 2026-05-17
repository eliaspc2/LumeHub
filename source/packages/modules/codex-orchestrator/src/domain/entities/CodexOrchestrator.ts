import type { AutomationSchedule, AutomationWeekdayToken } from '@lume-hub/admin-config';
import type { ScheduleEvent } from '@lume-hub/schedule-events';

export interface CodexOrchestratorPaths {
  readonly projectRoot: string;
  readonly sourceRoot: string;
  readonly dataRootPath: string;
  readonly configRootPath: string;
  readonly runtimeRootPath: string;
  readonly adminPhoneFilePath: string;
  readonly peopleFilePath: string;
  readonly groupSeedFilePath: string;
  readonly settingsFilePath: string;
}

export interface CodexOrchestratorStatus {
  readonly paths: CodexOrchestratorPaths;
  readonly admin: {
    readonly phoneFilePath: string;
    readonly configuredJid: string | null;
    readonly personId: string | null;
    readonly appOwner: boolean;
  };
  readonly policy: {
    readonly assistantEnabled: boolean;
    readonly schedulingEnabled: boolean;
    readonly autoReplyEnabled: boolean;
    readonly directRepliesEnabled: boolean;
    readonly allowPrivateAssistant: boolean;
    readonly authorizedPrivateJids: readonly string[];
    readonly authorizedGroupJids: readonly string[];
  };
  readonly groups: readonly {
    readonly groupJid: string;
    readonly preferredSubject: string;
    readonly schedulingEnabled: boolean;
    readonly mode: string;
    readonly promptExists: boolean;
  }[];
  readonly automations: readonly {
    readonly automationId: string;
    readonly groupJid: string;
    readonly groupLabel: string;
    readonly enabled: boolean;
    readonly schedule: AutomationSchedule;
    readonly messageTemplate: string | null;
  }[];
}

export interface SyncAdminResult {
  readonly adminJid: string;
  readonly personId: string;
  readonly authorizedPrivateJids: readonly string[];
}

export interface LockdownResult {
  readonly authorizedPrivateJids: readonly string[];
  readonly authorizedGroupJids: readonly string[];
}

export interface UpsertGroupPromptInput {
  readonly groupJid: string;
  readonly content: string;
}

export interface CreateScheduleEventInput {
  readonly groupJid: string;
  readonly title: string;
  readonly eventAt: string;
  readonly message?: string | null;
}

export interface CreateAutomationInput {
  readonly groupJid: string;
  readonly schedule: AutomationSchedule;
  readonly messageTemplate: string;
  readonly notifyBeforeMinutes?: readonly number[];
}

export interface CreateWeeklyAutomationInput {
  readonly groupJid: string;
  readonly daysOfWeek: readonly AutomationWeekdayToken[];
  readonly time: string;
  readonly messageTemplate: string;
  readonly notifyBeforeMinutes?: readonly number[];
}

export interface CodexOrchestratorModuleContract {
  readonly moduleName: 'codex-orchestrator';
  status(): Promise<CodexOrchestratorStatus>;
  syncAdminFromPhoneFile(phoneFilePath?: string): Promise<SyncAdminResult>;
  lockdownToAdminAndScheduledGroups(): Promise<LockdownResult>;
  upsertGroupPrompt(input: UpsertGroupPromptInput): Promise<{ readonly groupJid: string; readonly promptPath: string }>;
  createScheduleEvent(input: CreateScheduleEventInput): Promise<ScheduleEvent>;
  createAutomation(input: CreateAutomationInput): Promise<{ readonly automationId: string }>;
  createWeeklyAutomation(input: CreateWeeklyAutomationInput): Promise<{ readonly automationId: string }>;
}
