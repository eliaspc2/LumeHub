import type { NotificationRule } from '../entities/NotificationRule.js';

export interface NotificationRuleQuery {
  readonly groupJid?: string;
}

export interface NotificationRuleRepository {
  listRules(eventId: string, query?: NotificationRuleQuery): Promise<readonly NotificationRule[]>;
  replaceRules(
    eventId: string,
    rules: readonly NotificationRule[],
    query?: NotificationRuleQuery,
  ): Promise<readonly NotificationRule[]>;
}
