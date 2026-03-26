export type {
  ClassificationConfidence,
  IntentClassification,
  IntentClassificationInput,
  MessageIntent,
} from '../../domain/entities/IntentClassification.js';

export interface IntentClassifierModuleContract {
  readonly moduleName: 'intent-classifier';

  classifyMessage(
    input: import('../../domain/entities/IntentClassification.js').IntentClassificationInput,
  ): import('../../domain/entities/IntentClassification.js').IntentClassification;
}
