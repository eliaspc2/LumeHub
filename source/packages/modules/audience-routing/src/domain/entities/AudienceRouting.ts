import type { PersonIdentifier } from '@lume-hub/people-memory';

export interface SenderAudienceRule {
  readonly ruleId: string;
  readonly personId: string | null;
  readonly identifiers: readonly PersonIdentifier[];
  readonly targetGroupJids: readonly string[];
  readonly targetCourseIds: readonly string[];
  readonly targetDisciplineCodes: readonly string[];
  readonly enabled: boolean;
  readonly requiresConfirmation: boolean;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SenderAudienceRoutingFile {
  readonly schemaVersion: 1;
  readonly rules: readonly SenderAudienceRule[];
}

export interface SenderAudienceRuleUpsertInput {
  readonly ruleId?: string;
  readonly personId?: string | null;
  readonly identifiers?: readonly PersonIdentifier[];
  readonly targetGroupJids?: readonly string[];
  readonly targetCourseIds?: readonly string[];
  readonly targetDisciplineCodes?: readonly string[];
  readonly enabled?: boolean;
  readonly requiresConfirmation?: boolean;
  readonly notes?: string | null;
}

export interface ResolveTargetsForSenderInput {
  readonly personId?: string;
  readonly identifiers?: readonly PersonIdentifier[];
  readonly messageText?: string;
}

export interface ResolvedDistributionTarget {
  readonly groupJid: string;
  readonly preferredSubject: string;
  readonly courseId: string | null;
  readonly reasons: readonly string[];
}

export interface ResolvedSenderAudience {
  readonly senderPersonId: string | null;
  readonly senderDisplayName: string | null;
  readonly matchedRuleIds: readonly string[];
  readonly matchedDisciplineCodes: readonly string[];
  readonly requiresConfirmation: boolean;
  readonly targets: readonly ResolvedDistributionTarget[];
}

export interface DistributionTarget extends ResolvedDistributionTarget {
  readonly dedupeKey: string;
}

export interface DistributionPlan {
  readonly sourceMessageId: string;
  readonly senderPersonId: string | null;
  readonly senderDisplayName: string | null;
  readonly matchedRuleIds: readonly string[];
  readonly matchedDisciplineCodes: readonly string[];
  readonly requiresConfirmation: boolean;
  readonly targetCount: number;
  readonly targets: readonly DistributionTarget[];
}
