import type { AdminConfigModuleContract } from '@lume-hub/admin-config';
import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';

import type { AutomationService } from '../application/services/AutomationService.js';

export interface AutomationsModuleConfig {
  readonly adminConfig: Pick<AdminConfigModuleContract, 'getSettings' | 'updateAutomationSettings'>;
  readonly groupDirectory: Pick<GroupDirectoryModuleContract, 'listGroups'>;
  readonly legacyAutomationsFilePath: string;
  readonly runLogFilePath: string;
  readonly firedStateFilePath: string;
  readonly fetchImpl?: typeof fetch;
  readonly service?: AutomationService;
}
