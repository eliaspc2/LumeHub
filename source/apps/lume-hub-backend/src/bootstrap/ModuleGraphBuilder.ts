import { ModuleLoader as KernelModuleLoader, defineModule, type IModule, type ModuleDependency } from '@lume-hub/kernel';

import type { BackendModuleGraph } from './BackendRuntime.js';

export class ModuleGraphBuilder {
  private readonly loader = new KernelModuleLoader();

  build(modules: readonly IModule[]): BackendModuleGraph {
    const registrations = modules.map((module) =>
      defineModule(module.manifest, async () => module),
    );

    return {
      nodes: modules.map((module) => ({
        moduleName: module.name,
        dependencies: module.manifest.dependencies
          .map(normaliseDependency)
          .filter((dependency) => !dependency.optional)
          .map((dependency) => dependency.moduleName),
        optionalDependencies: module.manifest.dependencies
          .map(normaliseDependency)
          .filter((dependency) => dependency.optional)
          .map((dependency) => dependency.moduleName),
      })),
      registrations,
      loadOrder: this.loader.resolveLoadOrder(registrations).map((registration) => registration.manifest.name),
    };
  }
}

function normaliseDependency(dependency: ModuleDependency): {
  readonly moduleName: string;
  readonly optional: boolean;
} {
  if (typeof dependency === 'string') {
    return {
      moduleName: dependency,
      optional: false,
    };
  }

  return {
    moduleName: dependency.moduleName,
    optional: dependency.optional ?? false,
  };
}
