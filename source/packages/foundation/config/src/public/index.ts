export interface AppConfig {
  readonly appName: string;
  readonly environment: 'development' | 'test' | 'production';
  readonly timezone: string;
}

export class EnvironmentConfigLoader {
  load(source: NodeJS.ProcessEnv = process.env): Partial<AppConfig> {
    return {
      appName: source.LUME_HUB_APP_NAME,
      environment: (source.NODE_ENV as AppConfig['environment']) ?? 'development',
      timezone: source.LUME_HUB_TIMEZONE ?? 'Europe/Lisbon',
    };
  }
}

export class FileConfigLoader {
  load<TConfig>(value: TConfig): TConfig {
    return value;
  }
}

export class ConfigValidator {
  validate(config: Partial<AppConfig>): AppConfig {
    return {
      appName: config.appName ?? 'lume-hub',
      environment: config.environment ?? 'development',
      timezone: config.timezone ?? 'Europe/Lisbon',
    };
  }
}

export class ConfigResolver {
  constructor(
    private readonly environmentLoader = new EnvironmentConfigLoader(),
    private readonly validator = new ConfigValidator(),
  ) {}

  resolve(overrides: Partial<AppConfig> = {}): AppConfig {
    return this.validator.validate({
      ...this.environmentLoader.load(),
      ...overrides,
    });
  }
}
