export type {
  FormattedTerminalReply,
  OwnerCommand,
  OwnerCommandContext,
  OwnerCommandExecutionResult,
  OwnerScopeKind,
  OwnerScopeResolution,
  TerminalCommandExecutionOptions,
  TerminalCommandResult,
} from '../../domain/entities/OwnerControl.js';

export interface OwnerControlModuleContract {
  readonly moduleName: 'owner-control';

  detectOwnerCommand(messageText: string): import('../../domain/entities/OwnerControl.js').OwnerCommand | null;
  resolveOwnerScope(personId: string | null): Promise<import('../../domain/entities/OwnerControl.js').OwnerScopeResolution>;
  executeOwnerCommand(
    context: import('../../domain/entities/OwnerControl.js').OwnerCommandContext,
  ): Promise<import('../../domain/entities/OwnerControl.js').OwnerCommandExecutionResult>;
}
