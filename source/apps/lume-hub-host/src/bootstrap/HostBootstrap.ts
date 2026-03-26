import { HostModuleLoader } from './HostModuleLoader.js';

export class HostBootstrap {
  constructor(private readonly loader = new HostModuleLoader()) {}

  async start(): Promise<void> {
    for (const module of this.loader.load()) {
      await module.start();
    }
  }
}
