import { RuntimeBuilder } from './RuntimeBuilder.js';
import { ShutdownCoordinator } from './ShutdownCoordinator.js';

export class AppBootstrap {
  constructor(
    private readonly runtimeBuilder = new RuntimeBuilder(),
    private readonly shutdownCoordinator = new ShutdownCoordinator(),
  ) {}

  async start(): Promise<void> {
    const kernel = this.runtimeBuilder.build();
    this.shutdownCoordinator.install(() => kernel.stop());
    await kernel.start();
  }
}
