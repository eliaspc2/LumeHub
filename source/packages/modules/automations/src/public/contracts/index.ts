export interface AutomationsModuleContract {
  readonly moduleName: 'automations';
  listDefinitions(): Promise<readonly import('@lume-hub/admin-config').AutomationDefinition[]>;
  listRecentRuns(limit?: number): Promise<readonly import('../../domain/entities/Automation.js').AutomationRunRecord[]>;
  previewLegacyImport(): Promise<import('../../domain/entities/Automation.js').LegacyAutomationImportReport>;
  applyLegacyImport(): Promise<import('../../domain/entities/Automation.js').LegacyAutomationImportReport>;
  tick(
    sendRuntime: import('../../application/services/AutomationService.js').AutomationSendRuntime,
    now?: Date,
  ): Promise<import('../../domain/entities/Automation.js').AutomationTickResult>;
}
