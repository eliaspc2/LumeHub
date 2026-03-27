export class ShutdownCoordinator {
  private installedHandlers?: {
    readonly sigint: () => void;
    readonly sigterm: () => void;
  };
  private shuttingDown = false;

  install(shutdown: () => Promise<void>): void {
    this.dispose();

    const runShutdown = (): void => {
      if (this.shuttingDown) {
        return;
      }

      this.shuttingDown = true;

      void shutdown()
        .catch((error) => {
          console.error('Failed to shutdown lume-hub-backend cleanly.', error);
          process.exitCode = 1;
        })
        .finally(() => {
          process.exit();
        });
    };

    this.installedHandlers = {
      sigint: () => {
        runShutdown();
      },
      sigterm: () => {
        runShutdown();
      },
    };

    process.once('SIGINT', this.installedHandlers.sigint);
    process.once('SIGTERM', this.installedHandlers.sigterm);
  }

  dispose(): void {
    if (!this.installedHandlers) {
      return;
    }

    process.off('SIGINT', this.installedHandlers.sigint);
    process.off('SIGTERM', this.installedHandlers.sigterm);
    this.installedHandlers = undefined;
    this.shuttingDown = false;
  }
}
