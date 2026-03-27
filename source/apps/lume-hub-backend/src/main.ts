import { AppBootstrap } from './bootstrap/AppBootstrap.js';

const bootstrap = new AppBootstrap();

try {
  await bootstrap.start();
  const runtime = bootstrap.getRuntime();
  console.info(`lume-hub-backend runtime started on ${runtime.baseUrl ?? 'http://127.0.0.1:18420'}.`);
} catch (error) {
  console.error('Failed to start lume-hub-backend.', error);
  await bootstrap.stop().catch(() => undefined);
  process.exitCode = 1;
}
