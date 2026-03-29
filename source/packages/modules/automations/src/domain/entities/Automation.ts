import type { AutomationDefinition } from '@lume-hub/admin-config';

export interface AutomationRunRecord {
  readonly runId: string;
  readonly automationId: string;
  readonly entryId: string;
  readonly groupJid: string;
  readonly groupLabel: string;
  readonly offsetMinutes: number;
  readonly scheduledFor: string;
  readonly firedAt: string;
  readonly text: string;
  readonly actionTypes: readonly string[];
  readonly waMessageId: string | null;
  readonly webhookDeliveries: number;
  readonly status: 'executed' | 'failed';
  readonly error: string | null;
}

export interface AutomationRunLog {
  readonly runs: readonly AutomationRunRecord[];
}

export interface AutomationFiredState {
  readonly fired: Readonly<Record<string, string>>;
}

export interface LegacyAutomationImportDefinitionReport {
  readonly automationId: string;
  readonly entryId: string;
  readonly groupJid: string;
  readonly groupLabel: string;
  readonly scheduleLabel: string;
  readonly actionLabels: readonly string[];
}

export interface LegacyAutomationImportReport {
  readonly mode: 'preview' | 'apply';
  readonly sourceFilePath: string;
  readonly totals: {
    readonly legacyGroups: number;
    readonly legacyEntries: number;
    readonly importedDefinitions: number;
    readonly missingGroups: number;
  };
  readonly missingGroups: readonly {
    readonly groupLabel: string;
    readonly entryIds: readonly string[];
  }[];
  readonly definitions: readonly LegacyAutomationImportDefinitionReport[];
  readonly importedDefinitionsSnapshot: readonly AutomationDefinition[];
}

export interface AutomationTickResult {
  readonly executedCount: number;
  readonly failedCount: number;
  readonly runs: readonly AutomationRunRecord[];
}
