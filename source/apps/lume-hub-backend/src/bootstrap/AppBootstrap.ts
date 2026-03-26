import { RuntimeBuilder } from './RuntimeBuilder.js';
import { ShutdownCoordinator } from './ShutdownCoordinator.js';

export class AppBootstrap {
  private kernel?: ReturnType<RuntimeBuilder['build']>;

  constructor(
    private readonly runtimeBuilder = new RuntimeBuilder(),
    private readonly shutdownCoordinator = new ShutdownCoordinator(),
  ) {}

  async start(): Promise<void> {
    if (this.kernel) {
      return;
    }

    this.kernel = this.runtimeBuilder.build();
    this.shutdownCoordinator.install(() => this.kernel?.stop() ?? Promise.resolve());
    await this.kernel.start();
  }

  async stop(): Promise<void> {
    if (!this.kernel) {
      return;
    }

    await this.kernel.stop();
    this.kernel = undefined;
  }
}
