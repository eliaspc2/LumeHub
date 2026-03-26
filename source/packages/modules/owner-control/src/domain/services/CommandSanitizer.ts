export class CommandSanitizer {
  sanitize(command: string): string {
    const sanitized = command.replace(/\u0000/g, '').split(/\r?\n+/).join(' ').trim();

    if (!sanitized) {
      throw new Error('Empty owner terminal command.');
    }

    return sanitized;
  }
}
