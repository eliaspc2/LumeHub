import type { AdminConfigService } from '../application/services/AdminConfigService.js';
import type { AdminConfigRepository } from '../infrastructure/persistence/AdminConfigRepository.js';

export interface AdminConfigModuleConfig {
  readonly enabled?: boolean;
  readonly settingsFilePath?: string;
  readonly repository?: AdminConfigRepository;
  readonly service?: AdminConfigService;
}
