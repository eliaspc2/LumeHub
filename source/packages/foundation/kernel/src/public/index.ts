import type { ModuleHealth } from '@lume-hub/contracts';

export type ModuleEnvironment = 'development' | 'test' | 'production';

export interface ModuleContext {
  readonly startedAt: Date;
  readonly environment: ModuleEnvironment;
  readonly registry: ModuleRegistry;
  readonly container: RuntimeDependencyContainer;
}

export type ModuleDependency =
  | string
  | {
      readonly moduleName: string;
      readonly optional?: boolean;
    };

export interface ModuleManifest {
  readonly name: string;
  readonly version: string;
  readonly dependencies: readonly ModuleDependency[];
}

export interface Startable {
  start(): Promise<void>;
}

export interface Stoppable {
  stop(): Promise<void>;
}

export interface HealthCheckCapable {
  health(): Promise<ModuleHealth>;
}

export interface IModule extends Startable, Stoppable, HealthCheckCapable {
  readonly name: string;
  readonly manifest: ModuleManifest;
}

export interface ModuleRegistration<TModule extends IModule = IModule> {
  readonly manifest: ModuleManifest;
  readonly create: (context: ModuleContext) => TModule | Promise<TModule>;
}

export interface ModuleFactory<TModule extends IModule = IModule> extends ModuleRegistration<TModule> {}

export interface ApplicationKernelOptions {
  readonly environment?: ModuleEnvironment;
  readonly startedAt?: Date;
  readonly container?: RuntimeDependencyContainer;
}

export class RuntimeDependencyContainer {
  private readonly values = new Map<string, unknown>();

  register<TValue>(token: string, value: TValue): this {
    this.values.set(token, value);
    return this;
  }

  has(token: string): boolean {
    return this.values.has(token);
  }

  resolve<TValue>(token: string): TValue {
    if (!this.values.has(token)) {
      throw new Error(`Runtime dependency '${token}' is not registered.`);
    }

    return this.values.get(token) as TValue;
  }

  entries(): readonly [string, unknown][] {
    return [...this.values.entries()];
  }
}

export class RuntimeRegistry extends RuntimeDependencyContainer {}

export abstract class BaseModule implements IModule {
  readonly name: string;

  constructor(readonly manifest: ModuleManifest) {
    this.name = manifest.name;
  }

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  async health(): Promise<ModuleHealth> {
    return {
      status: 'healthy',
      details: {
        module: this.name,
      },
    };
  }
}

export class ModuleRegistry {
  private readonly manifests = new Map<string, ModuleManifest>();
  private readonly modules = new Map<string, IModule>();

  registerManifest(manifest: ModuleManifest): void {
    if (this.manifests.has(manifest.name)) {
      throw new Error(`Module manifest '${manifest.name}' is already registered.`);
    }

    this.manifests.set(manifest.name, manifest);
  }

  register(module: IModule): void {
    this.modules.set(module.name, module);
  }

  has(name: string): boolean {
    return this.manifests.has(name);
  }

  getManifest(name: string): ModuleManifest | undefined {
    return this.manifests.get(name);
  }

  getModule<TModule extends IModule = IModule>(name: string): TModule | undefined {
    return this.modules.get(name) as TModule | undefined;
  }

  listManifests(): readonly ModuleManifest[] {
    return [...this.manifests.values()];
  }

  listModules(): readonly IModule[] {
    return [...this.modules.values()];
  }
}

function normalizeDependency(dependency: ModuleDependency): {
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

export class ModuleLoader {
  resolveLoadOrder(registrations: readonly ModuleRegistration[]): readonly ModuleRegistration[] {
    const registrationMap = new Map(registrations.map((registration) => [registration.manifest.name, registration]));
    const ordered: ModuleRegistration[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (registration: ModuleRegistration): void => {
      const { name, dependencies } = registration.manifest;

      if (visited.has(name)) {
        return;
      }

      if (visiting.has(name)) {
        throw new Error(`Circular module dependency detected while loading '${name}'.`);
      }

      visiting.add(name);

      for (const dependency of dependencies) {
        const normalized = normalizeDependency(dependency);
        const dependencyRegistration = registrationMap.get(normalized.moduleName);

        if (!dependencyRegistration) {
          if (normalized.optional) {
            continue;
          }

          throw new Error(`Module '${name}' depends on missing module '${normalized.moduleName}'.`);
        }

        visit(dependencyRegistration);
      }

      visiting.delete(name);
      visited.add(name);
      ordered.push(registration);
    };

    for (const registration of registrations) {
      visit(registration);
    }

    return ordered;
  }

  async instantiate<TModule extends IModule>(
    registration: ModuleRegistration<TModule>,
    context: ModuleContext,
  ): Promise<TModule> {
    return registration.create(context);
  }
}

export class ShutdownCoordinator {
  private readonly handlers: Array<() => Promise<void>> = [];

  register(handler: () => Promise<void>): void {
    this.handlers.push(handler);
  }

  async run(): Promise<void> {
    for (const handler of [...this.handlers].reverse()) {
      await handler();
    }
  }
}

export class ApplicationKernel {
  private readonly registry = new ModuleRegistry();
  private readonly loader = new ModuleLoader();
  private readonly container: RuntimeDependencyContainer;
  private readonly context: ModuleContext;
  private readonly startedModules: IModule[] = [];

  constructor(
    private readonly registrations: readonly ModuleRegistration[] = [],
    options: ApplicationKernelOptions = {},
  ) {
    this.container = options.container ?? new RuntimeDependencyContainer();
    this.context = {
      startedAt: options.startedAt ?? new Date(),
      environment: options.environment ?? 'development',
      registry: this.registry,
      container: this.container,
    };

    for (const registration of this.registrations) {
      this.registry.registerManifest(registration.manifest);
    }
  }

  async start(): Promise<void> {
    const orderedRegistrations = this.loader.resolveLoadOrder(this.registrations);

    for (const registration of orderedRegistrations) {
      const module = await this.loader.instantiate(registration, this.context);
      this.registry.register(module);
      await module.start();
      this.startedModules.push(module);
    }
  }

  async stop(): Promise<void> {
    while (this.startedModules.length > 0) {
      const module = this.startedModules.pop();

      if (module) {
        await module.stop();
      }
    }
  }

  listModules(): readonly IModule[] {
    return this.registry.listModules();
  }

  getContext(): ModuleContext {
    return this.context;
  }
}

export function defineModule<TModule extends IModule>(
  manifest: ModuleManifest,
  create: (context: ModuleContext) => TModule | Promise<TModule>,
): ModuleRegistration<TModule> {
  return {
    manifest,
    create,
  };
}
