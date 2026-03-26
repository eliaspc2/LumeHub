import type {
  DistributionPlan,
  ResolveTargetsForSenderInput,
  ResolvedSenderAudience,
  SenderAudienceRule,
  SenderAudienceRuleUpsertInput,
} from '../../domain/entities/AudienceRouting.js';

export interface AudienceRoutingModuleContract {
  readonly moduleName: 'audience-routing';

  resolveTargetsForSender(input: ResolveTargetsForSenderInput): Promise<ResolvedSenderAudience>;
  previewDistributionPlan(sourceMessageId: string, input: ResolveTargetsForSenderInput): Promise<DistributionPlan>;
  upsertSenderAudienceRule(input: SenderAudienceRuleUpsertInput): Promise<SenderAudienceRule>;
  listSenderAudienceRules(): Promise<readonly SenderAudienceRule[]>;
}
