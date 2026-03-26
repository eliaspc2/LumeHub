import type {
  AssistantChatContext,
  BuildChatContextInput,
  SchedulingContext,
} from '@lume-hub/assistant-context';
import type { DistributionPlan } from '@lume-hub/audience-routing';
import type { PolicyActorContext } from '@lume-hub/command-policy';
import type { Instruction } from '@lume-hub/instruction-queue';
import type { IntentClassification, MessageIntent } from '@lume-hub/intent-classifier';
import type { LlmChatResult, LlmScheduleParseResult } from '@lume-hub/llm-orchestrator';
import type { OwnerCommandExecutionResult } from '@lume-hub/owner-control';
import type { PersonIdentifier } from '@lume-hub/people-memory';

export type AgentToolName =
  | 'owner_command'
  | 'fanout_preview'
  | 'fanout_execute'
  | 'schedule_parse'
  | 'chat_reply';

export type AgentToolResultStatus = 'success' | 'blocked' | 'skipped' | 'error';
export type AgentReplyMode = 'same_chat' | 'private' | 'silent';

export interface AgentTool {
  readonly name: AgentToolName;
  readonly description: string;
}

export interface AgentToolResult {
  readonly toolName: AgentToolName;
  readonly status: AgentToolResultStatus;
  readonly summary: string;
  readonly data?: unknown;
}

export interface AgentExecutionPlan {
  readonly intent: MessageIntent;
  readonly selectedTools: readonly AgentToolName[];
  readonly allowReply: boolean;
  readonly replyMode: AgentReplyMode;
  readonly notes: readonly string[];
}

export interface AgentAssistantTurnInput extends BuildChatContextInput {
  readonly messageId: string;
  readonly identifiers?: readonly PersonIdentifier[];
  readonly privateReplyJid?: string | null;
  readonly wasTagged?: boolean;
  readonly isReplyToBot?: boolean;
  readonly allowActions?: boolean;
}

export interface AgentSessionContext {
  readonly classification: IntentClassification;
  readonly policyContext: PolicyActorContext;
  readonly assistantAllowed: boolean;
  readonly chatContext: AssistantChatContext;
  readonly schedulingContext: SchedulingContext | null;
}

export interface AgentTurnResult {
  readonly plan: AgentExecutionPlan;
  readonly session: AgentSessionContext;
  readonly toolResults: readonly AgentToolResult[];
  readonly replyText: string | null;
  readonly distributionPlan: DistributionPlan | null;
  readonly enqueuedInstruction: Instruction | null;
  readonly ownerCommandResult: OwnerCommandExecutionResult | null;
  readonly scheduleParseResult: LlmScheduleParseResult | null;
  readonly llmChatResult: LlmChatResult | null;
}
