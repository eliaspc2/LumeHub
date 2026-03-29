import type { MessageAlertRule } from '@lume-hub/admin-config';

export interface MessageAlertMatchRecord {
  readonly matchId: string;
  readonly ruleId: string;
  readonly chatJid: string;
  readonly participantJid: string;
  readonly groupJid: string | null;
  readonly text: string;
  readonly matchedAt: string;
  readonly actionTypes: readonly string[];
  readonly webhookDeliveries: number;
}

export interface MessageAlertMatchLog {
  readonly matches: readonly MessageAlertMatchRecord[];
}

export interface LegacyAlertImportRuleReport {
  readonly ruleId: string;
  readonly enabled: boolean;
  readonly scopeLabel: string;
  readonly matcherLabel: string;
  readonly actionLabels: readonly string[];
}

export interface LegacyAlertImportReport {
  readonly mode: 'preview' | 'apply';
  readonly sourceFilePath: string;
  readonly totals: {
    readonly legacyRules: number;
    readonly importedRules: number;
  };
  readonly rules: readonly LegacyAlertImportRuleReport[];
  readonly importedRulesSnapshot: readonly MessageAlertRule[];
}
