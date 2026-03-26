export interface PersistenceGroupFilesAdapterConfig {
  readonly enabled?: boolean;
}

export class PersistenceGroupFilesAdapter {
  constructor(readonly config: PersistenceGroupFilesAdapterConfig = {}) {}

  describe(): Readonly<Record<string, unknown>> {
    return {
      adapter: 'persistence-group-files',
      enabled: this.config.enabled ?? true,
    };
  }
}
