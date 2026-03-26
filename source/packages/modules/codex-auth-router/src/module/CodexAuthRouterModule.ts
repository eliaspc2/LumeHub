import { BaseModule } from '@lume-hub/kernel';
import type { CodexAuthRouterModuleConfig } from './CodexAuthRouterModuleConfig.js';

export class CodexAuthRouterModule extends BaseModule {
  constructor(readonly config: CodexAuthRouterModuleConfig = {}) {
    super({
      name: 'codex-auth-router',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
