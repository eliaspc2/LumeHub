import type { IntentClassification, IntentClassificationInput } from '../../domain/entities/IntentClassification.js';
import { RuleBasedIntentClassifier } from '../../domain/services/RuleBasedIntentClassifier.js';

export class IntentClassifierService {
  constructor(private readonly classifier = new RuleBasedIntentClassifier()) {}

  classifyMessage(input: IntentClassificationInput): IntentClassification {
    return this.classifier.classify(input);
  }
}
