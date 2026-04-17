import type { ModuleContext } from '@lume-hub/kernel';

import type { CodexAuthBackupSyncModuleConfig } from './CodexAuthBackupSyncModuleConfig.js';
import { CodexAuthBackupSyncModule } from './CodexAuthBackupSyncModule.js';

export class CodexAuthBackupSyncModuleFactory {
  create(_context: ModuleContext, config: CodexAuthBackupSyncModuleConfig = {}): CodexAuthBackupSyncModule {
    return new CodexAuthBackupSyncModule(config);
  }
}
