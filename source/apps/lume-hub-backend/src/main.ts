import { AppBootstrap } from './bootstrap/AppBootstrap.js';

const bootstrap = new AppBootstrap();

try {
  await bootstrap.start();
  console.info('lume-hub-backend runtime started.');
} catch (error) {
  console.error('Failed to start lume-hub-backend.', error);
  await bootstrap.stop().catch(() => undefined);
  process.exitCode = 1;
}
