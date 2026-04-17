import { HostBootstrap } from './bootstrap/HostBootstrap.js';

const bootstrap = new HostBootstrap();
const HEARTBEAT_INTERVAL_MS = 60_000;

let heartbeatTimer: NodeJS.Timeout | undefined;
let shuttingDown = false;

const shutdown = async (): Promise<void> => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  }

  try {
    await bootstrap.stop();
  } finally {
    process.exit(0);
  }
};

process.once('SIGINT', () => {
  void shutdown();
});
process.once('SIGTERM', () => {
  void shutdown();
});

try {
  await bootstrap.start();

  heartbeatTimer = setInterval(() => {
    void bootstrap.heartbeat().catch((error) => {
      console.error('Failed to publish host heartbeat.', error);
    });
  }, HEARTBEAT_INTERVAL_MS);
} catch (error) {
  console.error('Failed to start lume-hub-host.', error);
  process.exitCode = 1;
}
