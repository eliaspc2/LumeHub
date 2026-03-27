import type { BackendRuntimeConfig } from './BackendRuntimeConfig.js';
import { RuntimeBuilder } from './RuntimeBuilder.js';
import { ShutdownCoordinator } from './ShutdownCoordinator.js';

export interface AppBootstrapOptions {
  readonly runtimeConfig?: BackendRuntimeConfig;
  readonly runtimeBuilder?: RuntimeBuilder;
  readonly shutdownCoordinator?: ShutdownCoordinator;
}

export class AppBootstrap {
  private kernel?: ReturnType<RuntimeBuilder['build']>;

  private readonly runtimeBuilder: RuntimeBuilder;
  private readonly shutdownCoordinator: ShutdownCoordinator;

  constructor(options: AppBootstrapOptions = {}) {
    this.runtimeBuilder =
      options.runtimeBuilder ??
      new RuntimeBuilder({
        runtimeConfig: options.runtimeConfig,
      });
    this.shutdownCoordinator = options.shutdownCoordinator ?? new ShutdownCoordinator();
  }

  async start(): Promise<void> {
    if (this.kernel) {
      return;
    }

    this.kernel = this.runtimeBuilder.build();
    this.shutdownCoordinator.install(() => this.stop());
    await this.kernel.start();
  }

  async stop(): Promise<void> {
    if (!this.kernel) {
      return;
    }

    await this.kernel.stop();
    this.kernel = undefined;
    this.shutdownCoordinator.dispose();
  }

  getRuntime(): NonNullable<typeof this.kernel> {
    if (!this.kernel) {
      throw new Error('Backend runtime is not started.');
    }

    return this.kernel;
  }
}
