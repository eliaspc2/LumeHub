import { AppRouter } from '../app/AppRouter.js';

export class AppShell {
  constructor(private readonly router = new AppRouter()) {}

  render(): string {
    return this.router.routes().join(' | ');
  }
}
