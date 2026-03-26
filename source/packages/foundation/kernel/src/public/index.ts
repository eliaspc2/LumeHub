import type { ModuleHealth } from '@lume-hub/contracts';

export interface ModuleManifest {
  readonly name: string;
  readonly version: string;
  readonly dependencies: readonly string[];
}

export interface ModuleContext {
  readonly startedAt: Date;
  readonly environment: 'development' | 'test' | 'production';
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

export interface ModuleFactory<TModule extends IModule = IModule> {
  create(context: ModuleContext): TModule;
}

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
      details: { module: this.name },
    };
  }
}

export class ModuleLoader {
  load<TModule extends IModule>(factory: ModuleFactory<TModule>, context: ModuleContext): TModule {
    return factory.create(context);
  }
}

export class ModuleRegistry {
  private readonly modules = new Map<string, IModule>();

  register(module: IModule): void {
    this.modules.set(module.name, module);
  }

  list(): readonly IModule[] {
    return [...this.modules.values()];
  }
}

export class RuntimeRegistry {
  private readonly values = new Map<string, unknown>();

  set(key: string, value: unknown): void {
    this.values.set(key, value);
  }

  get<TValue>(key: string): TValue | undefined {
    return this.values.get(key) as TValue | undefined;
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

  constructor(
    private readonly factories: readonly ModuleFactory[] = [],
    private readonly context: ModuleContext = {
      startedAt: new Date(),
      environment: 'development',
    },
  ) {}

  async start(): Promise<void> {
    for (const factory of this.factories) {
      const module = this.loader.load(factory, this.context);
      this.registry.register(module);
      await module.start();
    }
  }

  async stop(): Promise<void> {
    for (const module of [...this.registry.list()].reverse()) {
      await module.stop();
    }
  }

  listModules(): readonly IModule[] {
    return this.registry.list();
  }
}
