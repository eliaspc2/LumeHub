export class AppError extends Error {
  constructor(message: string, readonly code = 'APP_ERROR') {
    super(message);
    this.name = 'AppError';
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}
