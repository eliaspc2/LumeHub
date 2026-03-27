import type { BackendRuntimeConfig } from './BackendRuntimeConfig.js';
import { RuntimeBuilder } from './RuntimeBuilder.js';
import { ShutdownCoordinator } from './ShutdownCoordinator.js';

export interface AppBootstrapOptions {
  readonly runtimeConfig?: BackendRuntimeConfig;
  readonly runtimeBuilder?: RuntimeBuilder;
  readonly shutdownCoordinator?: ShutdownCoordinator;
}

export class AppBootstrap {
  private runtime?: ReturnType<RuntimeBuilder['build']>;

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
    if (this.runtime) {
      return;
    }

    this.runtime = this.runtimeBuilder.build();
    this.shutdownCoordinator.install(() => this.stop());

    try {
      await this.runtime.start();
      await this.runtime.listen();
    } catch (error) {
      await this.stop().catch(() => undefined);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.runtime) {
      return;
    }

    await this.runtime.stop();
    this.runtime = undefined;
    this.shutdownCoordinator.dispose();
  }

  getRuntime(): NonNullable<typeof this.runtime> {
    if (!this.runtime) {
      throw new Error('Backend runtime is not started.');
    }

    return this.runtime;
  }
}
