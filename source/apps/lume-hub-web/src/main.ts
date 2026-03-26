import { WebAppBootstrap } from './app/WebAppBootstrap.js';
import { AppShell } from './shell/AppShell.js';

const bootstrap = new WebAppBootstrap();
const shell = new AppShell(bootstrap.router, bootstrap.apiClientProvider.getBufferedEvents());

console.log(await shell.renderText());
