import type {
  AssistantChatContext,
  BuildChatContextInput,
  SchedulingContext,
} from '@lume-hub/assistant-context';
import type { DistributionPlan } from '@lume-hub/audience-routing';
import type { PolicyActorContext } from '@lume-hub/command-policy';
import type { CalendarAccessMode } from '@lume-hub/group-directory';
import type { Instruction } from '@lume-hub/instruction-queue';
import type { IntentClassification, MessageIntent } from '@lume-hub/intent-classifier';
import type { LlmChatResult, LlmScheduleConfidence, LlmScheduleParseResult } from '@lume-hub/llm-orchestrator';
import type { OwnerCommandExecutionResult } from '@lume-hub/owner-control';
import type { PersonIdentifier } from '@lume-hub/people-memory';
import type { WeeklyPlannerEventSummary } from '@lume-hub/weekly-planner';

export type AgentToolName =
  | 'owner_command'
  | 'fanout_preview'
  | 'fanout_execute'
  | 'schedule_parse'
  | 'schedule_apply'
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

export interface AgentMemoryDocumentRef {
  readonly documentId: string;
  readonly title: string;
  readonly filePath: string;
  readonly score: number;
  readonly matchedTerms: readonly string[];
}

export interface AgentMemoryUsage {
  readonly scope: 'none' | 'group';
  readonly groupJid: string | null;
  readonly groupLabel: string | null;
  readonly instructionsSource: AssistantChatContext['groupInstructionsSource'] | null;
  readonly instructionsApplied: boolean;
  readonly knowledgeSnippetCount: number;
  readonly knowledgeDocuments: readonly AgentMemoryDocumentRef[];
}

export interface AgentSchedulingInsight {
  readonly requestedAccessMode: CalendarAccessMode | null;
  readonly resolvedGroupJids: readonly string[];
  readonly memoryUsage: AgentMemoryUsage | null;
}

export type AgentScheduleOperation = 'create' | 'update' | 'delete';

export interface AgentScheduleDiffEntry {
  readonly label: string;
  readonly before: string | null;
  readonly after: string | null;
  readonly changed: boolean;
}

export interface AgentScheduleApplyPreview {
  readonly requestText: string;
  readonly requestedAccessMode: CalendarAccessMode | null;
  readonly groupJid: string | null;
  readonly groupLabel: string | null;
  readonly weekId: string | null;
  readonly previewFingerprint: string | null;
  readonly operation: AgentScheduleOperation | null;
  readonly confidence: LlmScheduleConfidence | null;
  readonly summary: string;
  readonly canApply: boolean;
  readonly blockingReason: string | null;
  readonly targetEvent: WeeklyPlannerEventSummary | null;
  readonly candidate: {
    readonly title: string | null;
    readonly localDate: string | null;
    readonly dayLabel: string | null;
    readonly startTime: string | null;
    readonly durationMinutes: number | null;
    readonly notes: string | null;
  } | null;
  readonly diff: readonly AgentScheduleDiffEntry[];
  readonly parserNotes: readonly string[];
}

export interface AgentScheduleActionInput extends AgentAssistantTurnInput {
  readonly weekId?: string | null;
  readonly requestedAccessMode?: CalendarAccessMode | null;
}

export interface AgentScheduleApplyInput extends AgentScheduleActionInput {
  readonly previewFingerprint?: string | null;
}

export interface AgentScheduleApplyResult {
  readonly preview: AgentScheduleApplyPreview;
  readonly instruction: Instruction;
  readonly appliedInstruction: Instruction | null;
  readonly appliedEvent: WeeklyPlannerEventSummary | null;
}

export interface AgentTurnResult {
  readonly plan: AgentExecutionPlan;
  readonly session: AgentSessionContext;
  readonly memoryUsage: AgentMemoryUsage;
  readonly schedulingInsight: AgentSchedulingInsight | null;
  readonly scheduleApplyPreview: AgentScheduleApplyPreview | null;
  readonly scheduleApplyResult: AgentScheduleApplyResult | null;
  readonly toolResults: readonly AgentToolResult[];
  readonly replyText: string | null;
  readonly distributionPlan: DistributionPlan | null;
  readonly enqueuedInstruction: Instruction | null;
  readonly ownerCommandResult: OwnerCommandExecutionResult | null;
  readonly scheduleParseResult: LlmScheduleParseResult | null;
  readonly llmChatResult: LlmChatResult | null;
}
