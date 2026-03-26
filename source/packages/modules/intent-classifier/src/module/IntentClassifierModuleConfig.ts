import type { IntentClassifierService } from '../application/services/IntentClassifierService.js';
import type { RuleBasedIntentClassifier } from '../domain/services/RuleBasedIntentClassifier.js';

export interface IntentClassifierModuleConfig {
  readonly enabled?: boolean;
  readonly classifier?: RuleBasedIntentClassifier;
  readonly service?: IntentClassifierService;
}
