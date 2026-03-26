import { BaseModule } from '@lume-hub/kernel';
import type { NotificationJobsModuleConfig } from './NotificationJobsModuleConfig.js';

export class NotificationJobsModule extends BaseModule {
  constructor(readonly config: NotificationJobsModuleConfig = {}) {
    super({
      name: 'notification-jobs',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
