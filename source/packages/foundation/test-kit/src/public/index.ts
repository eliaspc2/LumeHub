import type { ModuleHealth } from '@lume-hub/contracts';
import type { ModuleContext } from '@lume-hub/kernel';

export function createModuleContext(environment: ModuleContext['environment'] = 'test'): ModuleContext {
  return {
    startedAt: new Date(),
    environment,
  };
}

export function healthy(details: Readonly<Record<string, unknown>> = {}): ModuleHealth {
  return {
    status: 'healthy',
    details,
  };
}
