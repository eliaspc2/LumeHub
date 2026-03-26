import type { ModuleHealth } from '@lume-hub/contracts';
import { ModuleRegistry, RuntimeDependencyContainer, type ModuleContext } from '@lume-hub/kernel';

export function createModuleContext(environment: ModuleContext['environment'] = 'test'): ModuleContext {
  return {
    startedAt: new Date(),
    environment,
    registry: new ModuleRegistry(),
    container: new RuntimeDependencyContainer(),
  };
}

export function healthy(details: Readonly<Record<string, unknown>> = {}): ModuleHealth {
  return {
    status: 'healthy',
    details,
  };
}
