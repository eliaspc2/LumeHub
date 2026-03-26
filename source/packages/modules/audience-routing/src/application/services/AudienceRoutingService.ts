import { randomUUID } from 'node:crypto';

import type { DisciplineCatalogModuleContract } from '@lume-hub/discipline-catalog';
import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { PeopleMemoryModuleContract, Person, PersonIdentifier } from '@lume-hub/people-memory';
import { PersonIdentityMatcher } from '@lume-hub/people-memory';

import type {
  DistributionPlan,
  ResolveTargetsForSenderInput,
  ResolvedSenderAudience,
  SenderAudienceRule,
  SenderAudienceRuleUpsertInput,
} from '../../domain/entities/AudienceRouting.js';
import { DistributionPlanBuilder } from '../../domain/services/DistributionPlanBuilder.js';
import { FanOutPolicyEvaluator } from '../../domain/services/FanOutPolicyEvaluator.js';
import { SenderAudienceRepository } from '../../infrastructure/persistence/SenderAudienceRepository.js';

export class AudienceRoutingService {
  constructor(
    private readonly repository: SenderAudienceRepository,
    private readonly groupDirectory: GroupDirectoryModuleContract,
    private readonly disciplineCatalog: DisciplineCatalogModuleContract,
    private readonly peopleMemory: Pick<PeopleMemoryModuleContract, 'findPersonById' | 'findByIdentifiers'>,
    private readonly evaluator = new FanOutPolicyEvaluator(),
    private readonly planBuilder = new DistributionPlanBuilder(groupDirectory, disciplineCatalog),
    private readonly matcher = new PersonIdentityMatcher(),
  ) {}

  async resolveTargetsForSender(input: ResolveTargetsForSenderInput): Promise<ResolvedSenderAudience> {
    const senderPerson = await this.resolvePerson(input);
    const senderPersonId = input.personId ?? senderPerson?.personId ?? null;
    const senderIdentifiers = this.matcher.normaliseIdentifiers([
      ...(input.identifiers ?? []),
      ...(senderPerson?.identifiers ?? []),
    ]);
    const matchedRules = (await this.repository.listRules()).filter((rule) =>
      this.evaluator.matches(rule, {
        senderPersonId,
        senderIdentifiers,
      }),
    );

    return this.planBuilder.buildResolvedAudience({
      senderPersonId,
      senderDisplayName: senderPerson?.displayName ?? null,
      matchedRules,
      messageText: input.messageText,
    });
  }

  async previewDistributionPlan(
    sourceMessageId: string,
    input: ResolveTargetsForSenderInput,
  ): Promise<DistributionPlan> {
    return this.planBuilder.buildDistributionPlan(sourceMessageId, await this.resolveTargetsForSender(input));
  }

  async upsertSenderAudienceRule(input: SenderAudienceRuleUpsertInput, now = new Date()): Promise<SenderAudienceRule> {
    const current = await this.repository.read();
    const existing = input.ruleId ? current.rules.find((rule) => rule.ruleId === input.ruleId) : undefined;
    const nextRule: SenderAudienceRule = {
      ruleId: existing?.ruleId ?? input.ruleId ?? `audience-rule-${randomUUID()}`,
      personId: input.personId === undefined ? existing?.personId ?? null : input.personId?.trim() || null,
      identifiers: this.matcher.normaliseIdentifiers([...(existing?.identifiers ?? []), ...(input.identifiers ?? [])]),
      targetGroupJids: dedupeStrings([...(existing?.targetGroupJids ?? []), ...(input.targetGroupJids ?? [])]),
      targetCourseIds: dedupeStrings([...(existing?.targetCourseIds ?? []), ...(input.targetCourseIds ?? [])]),
      targetDisciplineCodes: dedupeStrings([
        ...(existing?.targetDisciplineCodes ?? []),
        ...(input.targetDisciplineCodes ?? []),
      ]),
      enabled: input.enabled ?? existing?.enabled ?? true,
      requiresConfirmation: input.requiresConfirmation ?? existing?.requiresConfirmation ?? false,
      notes: input.notes === undefined ? existing?.notes ?? null : input.notes?.trim() || null,
      createdAt: existing?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const nextRules = existing
      ? current.rules.map((rule) => (rule.ruleId === existing.ruleId ? nextRule : rule))
      : [...current.rules, nextRule];

    await this.repository.save({
      ...current,
      rules: nextRules,
    });

    return nextRule;
  }

  async listSenderAudienceRules(): Promise<readonly SenderAudienceRule[]> {
    return this.repository.listRules();
  }

  private async resolvePerson(input: ResolveTargetsForSenderInput): Promise<Person | undefined> {
    if (input.personId) {
      const person = await this.peopleMemory.findPersonById(input.personId);

      if (person) {
        return person;
      }
    }

    return input.identifiers && input.identifiers.length > 0
      ? this.peopleMemory.findByIdentifiers(input.identifiers)
      : undefined;
  }
}

function dedupeStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
