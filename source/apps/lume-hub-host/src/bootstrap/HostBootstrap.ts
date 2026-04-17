import { HostModuleLoader } from './HostModuleLoader.js';

export class HostBootstrap {
  constructor(private readonly loader = new HostModuleLoader()) {}
  private runtime?: ReturnType<HostModuleLoader['load']>;

  async start(): Promise<void> {
    if (this.runtime) {
      return;
    }

    this.runtime = this.loader.load();

    for (const module of this.runtime.modules) {
      await module.start();
    }
  }

  async heartbeat(input = {}): Promise<void> {
    if (!this.runtime) {
      throw new Error('HostBootstrap must be started before publishing heartbeats.');
    }

    await this.runtime.hostLifecycleModule.publishHeartbeat(input);
    await this.runtime.codexAuthBackupSyncModule.syncNow();
  }

  async stop(): Promise<void> {
    if (!this.runtime) {
      return;
    }

    for (const module of [...this.runtime.modules].reverse()) {
      await module.stop();
    }

    this.runtime = undefined;
  }

  getRuntime() {
    return this.runtime;
  }
}
