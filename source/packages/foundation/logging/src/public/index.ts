export interface LogContext {
  readonly module?: string;
  readonly requestId?: string;
  readonly [key: string]: unknown;
}

export class ModuleLogger {
  constructor(private readonly context: LogContext = {}) {}

  info(message: string, extra: Record<string, unknown> = {}): void {
    console.info(message, { ...this.context, ...extra });
  }

  warn(message: string, extra: Record<string, unknown> = {}): void {
    console.warn(message, { ...this.context, ...extra });
  }

  error(message: string, extra: Record<string, unknown> = {}): void {
    console.error(message, { ...this.context, ...extra });
  }

  debug(message: string, extra: Record<string, unknown> = {}): void {
    console.debug(message, { ...this.context, ...extra });
  }
}

export class LoggerFactory {
  create(context: LogContext = {}): ModuleLogger {
    return new ModuleLogger(context);
  }
}

export class AuditLogger extends ModuleLogger {}

export class LogContextBuilder {
  private readonly context: Record<string, unknown> = {};

  with(key: string, value: unknown): LogContextBuilder {
    this.context[key] = value;
    return this;
  }

  build(): LogContext {
    return { ...this.context };
  }
}
