import type { DisciplineCatalogModuleContract } from '@lume-hub/discipline-catalog';
import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';

import type {
  DistributionPlan,
  ResolvedDistributionTarget,
  ResolvedSenderAudience,
  SenderAudienceRule,
} from '../entities/AudienceRouting.js';

interface BuildResolvedAudienceInput {
  readonly senderPersonId: string | null;
  readonly senderDisplayName: string | null;
  readonly matchedRules: readonly SenderAudienceRule[];
  readonly messageText?: string;
}

interface MutableTarget {
  readonly groupJid: string;
  readonly preferredSubject: string;
  readonly courseId: string | null;
  readonly reasons: Set<string>;
}

export class DistributionPlanBuilder {
  constructor(
    private readonly groupDirectory: GroupDirectoryModuleContract,
    private readonly disciplineCatalog: DisciplineCatalogModuleContract,
  ) {}

  async buildResolvedAudience(input: BuildResolvedAudienceInput): Promise<ResolvedSenderAudience> {
    const targets = new Map<string, MutableTarget>();
    const messageDisciplines = input.messageText ? await this.disciplineCatalog.findFromText(input.messageText) : [];

    for (const rule of input.matchedRules) {
      await this.addExplicitGroups(targets, rule);
      await this.addCourseTargets(targets, rule);
      await this.addDisciplineTargets(targets, rule);
    }

    return {
      senderPersonId: input.senderPersonId,
      senderDisplayName: input.senderDisplayName,
      matchedRuleIds: dedupe(input.matchedRules.map((rule) => rule.ruleId)),
      matchedDisciplineCodes: dedupe([
        ...messageDisciplines.map((discipline) => discipline.code),
        ...input.matchedRules.flatMap((rule) => rule.targetDisciplineCodes),
      ]),
      requiresConfirmation: input.matchedRules.some((rule) => rule.requiresConfirmation),
      targets: [...targets.values()]
        .map((target) => ({
          groupJid: target.groupJid,
          preferredSubject: target.preferredSubject,
          courseId: target.courseId,
          reasons: [...target.reasons].sort(),
        }))
        .sort((left, right) => left.preferredSubject.localeCompare(right.preferredSubject)),
    };
  }

  buildDistributionPlan(sourceMessageId: string, audience: ResolvedSenderAudience): DistributionPlan {
    return {
      sourceMessageId,
      senderPersonId: audience.senderPersonId,
      senderDisplayName: audience.senderDisplayName,
      matchedRuleIds: audience.matchedRuleIds,
      matchedDisciplineCodes: audience.matchedDisciplineCodes,
      requiresConfirmation: audience.requiresConfirmation,
      targetCount: audience.targets.length,
      targets: audience.targets.map((target) => ({
        ...target,
        dedupeKey: `${sourceMessageId}:${target.groupJid}`,
      })),
    };
  }

  private async addExplicitGroups(targets: Map<string, MutableTarget>, rule: SenderAudienceRule): Promise<void> {
    for (const groupJid of rule.targetGroupJids) {
      const group = await this.groupDirectory.findByJid(groupJid);

      if (!group) {
        continue;
      }

      this.addTarget(targets, {
        groupJid: group.groupJid,
        preferredSubject: group.preferredSubject,
        courseId: group.courseId,
        reasons: [`rule:${rule.ruleId}`, `group:${group.groupJid}`],
      });
    }
  }

  private async addCourseTargets(targets: Map<string, MutableTarget>, rule: SenderAudienceRule): Promise<void> {
    for (const courseId of rule.targetCourseIds) {
      const channels = await this.disciplineCatalog.listGroupsForCourse(courseId);

      for (const channel of channels) {
        const group = await this.groupDirectory.findByJid(channel.groupJid);

        this.addTarget(targets, {
          groupJid: channel.groupJid,
          preferredSubject: group?.preferredSubject ?? channel.preferredSubject,
          courseId: group?.courseId ?? courseId,
          reasons: [`rule:${rule.ruleId}`, `course:${courseId}`],
        });
      }
    }
  }

  private async addDisciplineTargets(targets: Map<string, MutableTarget>, rule: SenderAudienceRule): Promise<void> {
    for (const code of rule.targetDisciplineCodes) {
      const discipline = await this.disciplineCatalog.findByCode(code);

      if (!discipline) {
        continue;
      }

      const channels = await this.disciplineCatalog.listGroupsForCourse(discipline.courseId);

      for (const channel of channels) {
        const group = await this.groupDirectory.findByJid(channel.groupJid);

        this.addTarget(targets, {
          groupJid: channel.groupJid,
          preferredSubject: group?.preferredSubject ?? channel.preferredSubject,
          courseId: group?.courseId ?? discipline.courseId,
          reasons: [`rule:${rule.ruleId}`, `discipline:${discipline.code}`],
        });
      }
    }
  }

  private addTarget(
    targets: Map<string, MutableTarget>,
    target: Omit<ResolvedDistributionTarget, 'reasons'> & { readonly reasons: readonly string[] },
  ): void {
    const current = targets.get(target.groupJid);

    if (current) {
      for (const reason of target.reasons) {
        current.reasons.add(reason);
      }

      return;
    }

    targets.set(target.groupJid, {
      groupJid: target.groupJid,
      preferredSubject: target.preferredSubject,
      courseId: target.courseId,
      reasons: new Set(target.reasons),
    });
  }
}

function dedupe(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}
