import { ApiClientProvider } from './ApiClientProvider.js';
import { AppRouter } from './AppRouter.js';
import { QueryClientFactory } from './QueryClientFactory.js';

export class WebAppBootstrap {
  constructor(
    readonly apiClientProvider = new ApiClientProvider(),
    readonly queryClientFactory = new QueryClientFactory(),
    readonly router = new AppRouter(),
  ) {}
}
