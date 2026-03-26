import { readFile } from 'node:fs/promises';
import { z } from 'zod';

export const AppEnvironmentSchema = z.enum(['development', 'test', 'production']);
export type AppEnvironment = z.infer<typeof AppEnvironmentSchema>;

export const AppConfigSchema = z.object({
  appName: z.string().trim().min(1).default('lume-hub'),
  environment: AppEnvironmentSchema.default('development'),
  timezone: z.string().trim().min(1).default('Europe/Lisbon'),
  dataRoot: z.string().trim().min(1).default('data'),
  logLevel: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export type AppConfig = Readonly<z.infer<typeof AppConfigSchema>>;
type PartialAppConfig = Partial<z.input<typeof AppConfigSchema>>;

function deepFreeze<TValue>(value: TValue): TValue {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);

    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nestedValue);
    }
  }

  return value;
}

export class EnvironmentConfigLoader {
  load(source: NodeJS.ProcessEnv = process.env): PartialAppConfig {
    return {
      appName: source.LUME_HUB_APP_NAME,
      environment: (source.LUME_HUB_ENVIRONMENT ?? source.NODE_ENV) as PartialAppConfig['environment'],
      timezone: source.LUME_HUB_TIMEZONE,
      dataRoot: source.LUME_HUB_DATA_ROOT,
      logLevel: source.LUME_HUB_LOG_LEVEL as PartialAppConfig['logLevel'],
    };
  }
}

export class FileConfigLoader {
  async load(filePath: string): Promise<PartialAppConfig> {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as PartialAppConfig;
  }
}

export class ConfigValidator {
  validate(config: PartialAppConfig): AppConfig {
    return deepFreeze(AppConfigSchema.parse(config));
  }
}

export interface ConfigResolveOptions {
  readonly filePath?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly overrides?: PartialAppConfig;
}

export class ConfigResolver {
  constructor(
    private readonly environmentLoader = new EnvironmentConfigLoader(),
    private readonly fileLoader = new FileConfigLoader(),
    private readonly validator = new ConfigValidator(),
  ) {}

  async resolve(options: ConfigResolveOptions = {}): Promise<AppConfig> {
    const fileConfig = options.filePath ? await this.fileLoader.load(options.filePath) : {};
    const envConfig = this.environmentLoader.load(options.env);

    return this.validator.validate({
      ...fileConfig,
      ...envConfig,
      ...options.overrides,
    });
  }
}
