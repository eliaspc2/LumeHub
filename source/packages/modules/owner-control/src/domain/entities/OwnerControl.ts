import type { CalendarAccessMode } from '@lume-hub/group-directory';
import type { Instruction } from '@lume-hub/instruction-queue';

export type OwnerScopeKind = 'none' | 'group_owner' | 'app_owner';
export type OwnerCommandKind = 'terminal' | 'queue_list' | 'queue_retry' | 'calendar_access';

export interface OwnerScopeResolution {
  readonly scope: OwnerScopeKind;
  readonly personId: string | null;
  readonly allowedGroupJids: readonly string[];
}

export interface OwnerCommand {
  readonly kind: OwnerCommandKind;
  readonly rawText: string;
  readonly argument: string | null;
}

export interface OwnerCommandContext {
  readonly personId: string | null;
  readonly groupJid?: string | null;
  readonly messageText: string;
  readonly timeoutMs?: number;
}

export interface TerminalCommandExecutionOptions {
  readonly timeoutMs?: number;
  readonly maxOutputChars?: number;
}

export interface TerminalCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly timedOut: boolean;
}

export interface FormattedTerminalReply {
  readonly output: string;
  readonly truncated: boolean;
}

export interface OwnerCommandExecutionResult {
  readonly accepted: boolean;
  readonly scope: OwnerScopeResolution;
  readonly command: OwnerCommand | null;
  readonly output: string;
  readonly truncated: boolean;
  readonly exitCode: number | null;
  readonly reason: string | null;
  readonly visibleInstructions?: readonly Instruction[];
  readonly calendarAccessMode?: CalendarAccessMode | null;
}
