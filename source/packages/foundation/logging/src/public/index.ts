import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino';

export interface LogContext {
  readonly module?: string;
  readonly requestId?: string;
  readonly [key: string]: unknown;
}

export class ModuleLogger {
  constructor(protected readonly logger: PinoLogger) {}

  info(message: string, extra: Record<string, unknown> = {}): void {
    this.logger.info(extra, message);
  }

  warn(message: string, extra: Record<string, unknown> = {}): void {
    this.logger.warn(extra, message);
  }

  error(message: string, extra: Record<string, unknown> = {}): void {
    this.logger.error(extra, message);
  }

  debug(message: string, extra: Record<string, unknown> = {}): void {
    this.logger.debug(extra, message);
  }

  child(context: LogContext = {}): ModuleLogger {
    return new ModuleLogger(this.logger.child(context));
  }

  raw(): PinoLogger {
    return this.logger;
  }
}

export class AuditLogger extends ModuleLogger {
  audit(action: string, details: Record<string, unknown> = {}): void {
    this.logger.info(
      {
        channel: 'audit',
        action,
        ...details,
      },
      action,
    );
  }
}

export class LogContextBuilder {
  private readonly context: Record<string, unknown> = {};

  withModule(moduleName: string): LogContextBuilder {
    this.context.module = moduleName;
    return this;
  }

  withRequestId(requestId: string): LogContextBuilder {
    this.context.requestId = requestId;
    return this;
  }

  with(key: string, value: unknown): LogContextBuilder {
    this.context[key] = value;
    return this;
  }

  build(): LogContext {
    return { ...this.context };
  }
}

export class LoggerFactory {
  private readonly rootLogger: PinoLogger;

  constructor(options: LoggerOptions = {}) {
    this.rootLogger = pino({
      name: 'lume-hub',
      level: options.level ?? 'info',
      ...options,
    });
  }

  create(context: LogContext = {}): ModuleLogger {
    return new ModuleLogger(this.rootLogger.child(context));
  }

  createModuleLogger(moduleName: string, context: LogContext = {}): ModuleLogger {
    return this.create({
      module: moduleName,
      ...context,
    });
  }

  createAuditLogger(context: LogContext = {}): AuditLogger {
    return new AuditLogger(
      this.rootLogger.child({
        channel: 'audit',
        ...context,
      }),
    );
  }

  root(): PinoLogger {
    return this.rootLogger;
  }
}
