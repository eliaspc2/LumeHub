export interface MessageAlertsModuleContract {
  readonly moduleName: 'message-alerts';
  listRules(): Promise<readonly import('@lume-hub/admin-config').MessageAlertRule[]>;
  listRecentMatches(
    limit?: number,
  ): Promise<readonly import('../../domain/entities/MessageAlert.js').MessageAlertMatchRecord[]>;
  previewLegacyImport(): Promise<import('../../domain/entities/MessageAlert.js').LegacyAlertImportReport>;
  applyLegacyImport(): Promise<import('../../domain/entities/MessageAlert.js').LegacyAlertImportReport>;
  handleInbound(
    message: import('@lume-hub/whatsapp-baileys').NormalizedInboundMessage,
  ): Promise<readonly import('../../domain/entities/MessageAlert.js').MessageAlertMatchRecord[]>;
}
