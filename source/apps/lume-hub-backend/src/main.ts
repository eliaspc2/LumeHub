import { AppBootstrap } from './bootstrap/AppBootstrap.js';

const bootstrap = new AppBootstrap();
const KEEPALIVE_INTERVAL_MS = 60_000;

let keepAliveTimer: NodeJS.Timeout | undefined;
let shuttingDown = false;

try {
  await bootstrap.start();
  keepAliveTimer = setInterval(() => {
    // Keep the backend process alive until a real network/runtime listener is attached.
  }, KEEPALIVE_INTERVAL_MS);
  installShutdownHandlers();
} catch (error) {
  console.error('Failed to start lume-hub-backend.', error);
  process.exitCode = 1;
}

function installShutdownHandlers(): void {
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = undefined;
    }

    try {
      await bootstrap.stop();
    } finally {
      process.exit();
    }
  };

  process.once('SIGINT', () => {
    void shutdown();
  });
  process.once('SIGTERM', () => {
    void shutdown();
  });
}
