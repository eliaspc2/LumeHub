export interface AdminConfigModuleContract {
  readonly moduleName: 'admin-config';

  getSettings(): Promise<import('../../domain/entities/AdminConfig.js').AdminSettings>;
  updateCommandsSettings(
    update: Partial<import('../../domain/entities/AdminConfig.js').CommandsPolicySettings>,
  ): Promise<import('../../domain/entities/AdminConfig.js').AdminSettings>;
  updateLlmSettings(
    update: Partial<import('../../domain/entities/AdminConfig.js').LlmRuntimeSettings>,
  ): Promise<import('../../domain/entities/AdminConfig.js').AdminSettings>;
  getLlmRuntimeStatus(
    input?: import('../../domain/entities/AdminConfig.js').LlmRuntimeStatusInput,
  ): Promise<import('../../domain/entities/AdminConfig.js').LlmRuntimeStatusSnapshot>;
  updateWhatsAppSettings(
    update: Partial<import('../../domain/entities/AdminConfig.js').WhatsAppSettings>,
  ): Promise<import('../../domain/entities/AdminConfig.js').AdminSettings>;
  updateAlertsSettings(
    update: Partial<import('../../domain/entities/AdminConfig.js').MessageAlertsSettings>,
  ): Promise<import('../../domain/entities/AdminConfig.js').AdminSettings>;
  updateAutomationSettings(
    update: Partial<import('../../domain/entities/AdminConfig.js').AutomationsSettings>,
  ): Promise<import('../../domain/entities/AdminConfig.js').AdminSettings>;
  updateUiSettings(
    update: Partial<import('../../domain/entities/AdminConfig.js').UiSettings>,
  ): Promise<import('../../domain/entities/AdminConfig.js').AdminSettings>;
}
