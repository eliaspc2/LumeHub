import type { ModuleContext } from '@lume-hub/kernel';
import { NotificationJobsModule } from './NotificationJobsModule.js';
import type { NotificationJobsModuleConfig } from './NotificationJobsModuleConfig.js';

export class NotificationJobsModuleFactory {
  create(_context: ModuleContext, config: NotificationJobsModuleConfig = {}): NotificationJobsModule {
    return new NotificationJobsModule(config);
  }
}
