import { ApplicationKernel, RuntimeDependencyContainer } from '@lume-hub/kernel';

import { BackendRuntime } from './BackendRuntime.js';
import { resolveBackendEnvironment, type BackendRuntimeConfig } from './BackendRuntimeConfig.js';
import { ModuleGraphBuilder } from './ModuleGraphBuilder.js';
import { ModuleLoader } from './ModuleLoader.js';

export interface KernelFactoryOptions {
  readonly runtimeConfig?: BackendRuntimeConfig;
  readonly moduleLoader?: ModuleLoader;
  readonly moduleGraphBuilder?: ModuleGraphBuilder;
}

export class KernelFactory {
  constructor(private readonly options: KernelFactoryOptions = {}) {}

  create(): BackendRuntime {
    const runtimeConfig = this.options.runtimeConfig ?? {};
    const loaded = (this.options.moduleLoader ?? new ModuleLoader(runtimeConfig)).load();
    const moduleGraph = (this.options.moduleGraphBuilder ?? new ModuleGraphBuilder()).build(loaded.modules.modules);
    const container = new RuntimeDependencyContainer()
      .register('adapter:http-server', loaded.httpServer)
      .register('adapter:ws-gateway', loaded.webSocketGateway)
      .register('backend.paths', loaded.paths)
      .register('backend.module-graph', moduleGraph);

    for (const module of loaded.modules.modules) {
      container.register(`module:${module.name}`, module);
    }

    const kernel = new ApplicationKernel(moduleGraph.registrations, {
      environment: resolveBackendEnvironment(runtimeConfig),
      container,
    });
    const runtime = new BackendRuntime({
      kernel,
      httpServer: loaded.httpServer,
      webSocketGateway: loaded.webSocketGateway,
      modules: loaded.modules,
      moduleGraph,
      paths: loaded.paths,
      operationalTickIntervalMs: runtimeConfig.operationalTickIntervalMs,
    });

    container.register('backend.runtime', runtime);
    return runtime;
  }
}
