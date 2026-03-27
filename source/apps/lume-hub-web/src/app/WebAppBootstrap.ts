import type { FrontendApiTransport } from '@lume-hub/frontend-api-client';

import { ApiClientProvider } from './ApiClientProvider.js';
import { AppRouter } from './AppRouter.js';
import { QueryClientFactory, type QueryClient } from './QueryClientFactory.js';

export interface WebAppBootstrapConfig {
  readonly transport?: FrontendApiTransport;
}

export class WebAppBootstrap {
  readonly apiClientProvider: ApiClientProvider;
  readonly queryClientFactory: QueryClientFactory;
  readonly queryClient: QueryClient;
  readonly router: AppRouter;

  constructor(
    readonly config: WebAppBootstrapConfig = {},
    apiClientProvider = new ApiClientProvider({
      transport: config.transport,
    }),
    queryClientFactory = new QueryClientFactory(),
  ) {
    this.apiClientProvider = apiClientProvider;
    this.queryClientFactory = queryClientFactory;
    this.queryClient = this.queryClientFactory.create();
    this.router = new AppRouter(this.apiClientProvider.getClient(), this.queryClient);
  }
}
