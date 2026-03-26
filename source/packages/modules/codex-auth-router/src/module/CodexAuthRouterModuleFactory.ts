import type { ModuleContext } from '@lume-hub/kernel';
import { CodexAuthRouterModule } from './CodexAuthRouterModule.js';
import type { CodexAuthRouterModuleConfig } from './CodexAuthRouterModuleConfig.js';

export class CodexAuthRouterModuleFactory {
  create(_context: ModuleContext, config: CodexAuthRouterModuleConfig = {}): CodexAuthRouterModule {
    return new CodexAuthRouterModule(config);
  }
}
