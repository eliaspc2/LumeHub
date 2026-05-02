import type { DistributionPlan } from '@lume-hub/audience-routing';
import type { CalendarAccessMode } from '@lume-hub/group-directory';
import type { WeeklyPlannerEventSummary, WeeklyPlannerUpsertInput } from '@lume-hub/weekly-planner';

export type InstructionStatus = 'queued' | 'running' | 'completed' | 'partial_failed' | 'failed';
export type InstructionActionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type InstructionMode = 'dry_run' | 'confirmed';

export interface InstructionActionExecutionResult {
  readonly externalMessageId?: string | null;
  readonly note?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export interface InstructionActionInput {
  readonly type: string;
  readonly dedupeKey?: string | null;
  readonly targetGroupJid?: string | null;
  readonly payload?: Record<string, unknown>;
}

export interface InstructionAction extends InstructionActionInput {
  readonly actionId: string;
  readonly dedupeKey: string | null;
  readonly targetGroupJid: string | null;
  readonly payload: Record<string, unknown>;
  readonly status: InstructionActionStatus;
  readonly attemptCount: number;
  readonly lastError: string | null;
  readonly result: InstructionActionExecutionResult | null;
  readonly lastAttemptAt: string | null;
  readonly completedAt: string | null;
}

export interface InstructionEnqueueInput {
  readonly sourceType: string;
  readonly sourceMessageId?: string | null;
  readonly mode?: InstructionMode;
  readonly metadata?: Record<string, unknown>;
  readonly actions: readonly InstructionActionInput[];
}

export interface Instruction {
  readonly instructionId: string;
  readonly sourceType: string;
  readonly sourceMessageId: string | null;
  readonly mode: InstructionMode;
  readonly status: InstructionStatus;
  readonly metadata: Record<string, unknown>;
  readonly actions: readonly InstructionAction[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InstructionQueueFile {
  readonly schemaVersion: 1;
  readonly instructions: readonly Instruction[];
}

export interface InstructionTickResult {
  readonly recoveredActionIds: readonly string[];
  readonly processedInstructionIds: readonly string[];
  readonly processedActionIds: readonly string[];
  readonly failedActionIds: readonly string[];
}

interface BaseDistributionActionPayload {
  readonly sourceMessageId: string;
  readonly sourcePersonId: string | null;
  readonly sourceDisplayName: string | null;
  readonly targetGroupJid: string;
  readonly targetLabel: string;
  readonly requiresConfirmation: boolean;
}

export type DistributionActionPayload =
  | (BaseDistributionActionPayload & {
      readonly kind: 'text';
      readonly messageText: string;
    })
  | (BaseDistributionActionPayload & {
      readonly kind: 'media';
      readonly assetId: string;
      readonly caption: string | null;
    });

export type DistributionContentInput =
  | {
      readonly kind: 'text';
      readonly messageText: string;
    }
  | {
      readonly kind: 'media';
      readonly assetId: string;
      readonly caption?: string | null;
    };

export interface DistributionPlanEnqueueInput {
  readonly plan: DistributionPlan;
  readonly content: DistributionContentInput;
  readonly mode: InstructionMode;
}

export type ScheduleApplyOperation = 'create' | 'update' | 'delete';

export interface ScheduleApplyDiffEntry {
  readonly label: string;
  readonly before: string | null;
  readonly after: string | null;
  readonly changed: boolean;
}

export interface ScheduleApplyActionPayload {
  readonly kind: 'schedule_apply';
  readonly operation: ScheduleApplyOperation;
  readonly sourceMessageId: string;
  readonly requestedText: string;
  readonly requestedByPersonId: string | null;
  readonly requestedByDisplayName: string | null;
  readonly requestedAccessMode: CalendarAccessMode | null;
  readonly previewFingerprint: string;
  readonly previewSummary: string;
  readonly groupJid: string;
  readonly groupLabel: string | null;
  readonly weekId: string;
  readonly targetEventId: string | null;
  readonly targetEvent: WeeklyPlannerEventSummary | null;
  readonly diff: readonly ScheduleApplyDiffEntry[];
  readonly upsert: WeeklyPlannerUpsertInput | null;
  readonly deleteEventId: string | null;
}

export interface ScheduleApplyEnqueueInput {
  readonly payload: ScheduleApplyActionPayload;
  readonly mode: InstructionMode;
  readonly dedupeKey?: string | null;
}

export interface ReminderDeliveryActionPayload {
  readonly kind: 'reminder_delivery';
  readonly jobId: string;
  readonly eventId: string;
  readonly ruleId: string;
  readonly ruleLabel: string | null;
  readonly mediaAssetId: string | null;
  readonly groupJid: string;
  readonly groupLabel: string;
  readonly eventTitle: string;
  readonly eventAt: string;
  readonly sendAt: string;
  readonly timeZone: string;
  readonly summaryLabel: string;
  readonly messageTemplate: string | null;
  readonly llmPromptTemplate: string | null;
}
