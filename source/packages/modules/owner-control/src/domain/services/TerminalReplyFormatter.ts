import type { FormattedTerminalReply, TerminalCommandResult } from '../entities/OwnerControl.js';

export class TerminalReplyFormatter {
  format(result: TerminalCommandResult, maxOutputChars = 2_000): FormattedTerminalReply {
    const chunks = [
      result.stdout.trim() ? `stdout:\n${result.stdout.trim()}` : '',
      result.stderr.trim() ? `stderr:\n${result.stderr.trim()}` : '',
      result.timedOut ? 'status:\ntimed out' : '',
      result.exitCode !== 0 && result.exitCode !== null ? `exit:\n${result.exitCode}` : '',
    ].filter(Boolean);

    return this.formatText(chunks.join('\n\n') || 'Command completed with no output.', maxOutputChars);
  }

  formatText(text: string, maxOutputChars = 2_000): FormattedTerminalReply {
    if (text.length <= maxOutputChars) {
      return {
        output: text,
        truncated: false,
      };
    }

    return {
      output: `${text.slice(0, maxOutputChars - 1)}…`,
      truncated: true,
    };
  }
}
