import { WebAppBootstrap } from './app/WebAppBootstrap.js';
import { AppShell } from './shell/AppShell.js';

const bootstrap = new WebAppBootstrap();
const shell = new AppShell(bootstrap.router);

console.log(shell.render());
