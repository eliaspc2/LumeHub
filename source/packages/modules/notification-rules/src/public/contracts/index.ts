export type {
  NotificationRule,
  NotificationRuleDefinitionInput,
  NotificationRuleKind,
} from '../../domain/entities/NotificationRule.js';
export type { NotificationRuleQuery } from '../../domain/repositories/NotificationRuleRepository.js';

export interface NotificationRulesModuleContract {
  readonly moduleName: 'notification-rules';
  deriveRulesForEvent(
    eventId: string,
    definitions?: readonly import('../../domain/entities/NotificationRule.js').NotificationRuleDefinitionInput[],
    query?: import('../../domain/repositories/NotificationRuleRepository.js').NotificationRuleQuery,
  ): Promise<readonly import('../../domain/entities/NotificationRule.js').NotificationRule[]>;
  replaceRulesForEvent(
    eventId: string,
    definitions: readonly import('../../domain/entities/NotificationRule.js').NotificationRuleDefinitionInput[],
    query?: import('../../domain/repositories/NotificationRuleRepository.js').NotificationRuleQuery,
  ): Promise<readonly import('../../domain/entities/NotificationRule.js').NotificationRule[]>;
  listRulesForEvent(
    eventId: string,
    query?: import('../../domain/repositories/NotificationRuleRepository.js').NotificationRuleQuery,
  ): Promise<readonly import('../../domain/entities/NotificationRule.js').NotificationRule[]>;
}
