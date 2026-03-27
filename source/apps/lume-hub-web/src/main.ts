import './styles/app.css';

import { createFrontendTransport, createInitialTransportMode } from './app/BrowserTransportFactory.js';
import { WebAppBootstrap } from './app/WebAppBootstrap.js';
import { AppShell } from './shell/AppShell.js';

const root = document.querySelector('#app');

if (!(root instanceof HTMLElement)) {
  throw new Error('Missing #app mount element.');
}

const createBootstrap = (mode: ReturnType<typeof createInitialTransportMode>) =>
  new WebAppBootstrap({
    transport: createFrontendTransport(mode),
  });

new AppShell(createBootstrap, createInitialTransportMode()).mount(root);
