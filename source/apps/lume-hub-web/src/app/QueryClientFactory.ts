export interface QueryClient {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): T;
}

export class QueryClientFactory {
  create(): QueryClient {
    const store = new Map<string, unknown>();

    return {
      get<T>(key: string): T | undefined {
        return store.get(key) as T | undefined;
      },
      set<T>(key: string, value: T): T {
        store.set(key, value);
        return value;
      },
    };
  }
}
