import { PersonIdentityMatcher } from '@lume-hub/people-memory';

import type { SenderAudienceRule } from '../entities/AudienceRouting.js';

export interface SenderMatchContext {
  readonly senderPersonId: string | null;
  readonly senderIdentifiers: readonly { kind: string; value: string }[];
}

export class FanOutPolicyEvaluator {
  constructor(private readonly matcher = new PersonIdentityMatcher()) {}

  matches(rule: SenderAudienceRule, context: SenderMatchContext): boolean {
    if (!rule.enabled) {
      return false;
    }

    const matchesPerson =
      Boolean(rule.personId) &&
      Boolean(context.senderPersonId) &&
      normaliseKey(rule.personId ?? '') === normaliseKey(context.senderPersonId ?? '');
    const matchesIdentifiers =
      rule.identifiers.length > 0 && this.matcher.identifiersMatch(rule.identifiers, context.senderIdentifiers);

    return matchesPerson || matchesIdentifiers;
  }
}

function normaliseKey(value: string): string {
  return value.trim().toLowerCase();
}
