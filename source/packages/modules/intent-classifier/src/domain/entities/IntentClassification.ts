import type { CalendarAccessMode } from '@lume-hub/group-directory';

export type MessageIntent =
  | 'owner_command'
  | 'fanout_request'
  | 'scheduling_request'
  | 'local_summary_request'
  | 'operational_instruction'
  | 'casual_chat'
  | 'unknown';

export type ClassificationConfidence = 'low' | 'medium' | 'high';

export interface IntentClassificationInput {
  readonly text: string;
  readonly chatType?: 'group' | 'private';
  readonly wasTagged?: boolean;
  readonly isReplyToBot?: boolean;
}

export interface IntentClassification {
  readonly intent: MessageIntent;
  readonly confidence: ClassificationConfidence;
  readonly reasons: readonly string[];
  readonly requestedAccessMode: CalendarAccessMode | null;
}
