import type { AdminConfigModuleContract } from '@lume-hub/admin-config';

import type { MessageAlertService } from '../application/services/MessageAlertService.js';

export interface MessageAlertsModuleConfig {
  readonly adminConfig: Pick<AdminConfigModuleContract, 'getSettings' | 'updateAlertsSettings'>;
  readonly legacyAlertsFilePath: string;
  readonly auditFilePath: string;
  readonly fetchImpl?: typeof fetch;
  readonly service?: MessageAlertService;
}
