import { BaseModule } from '@lume-hub/kernel';

import { IntentClassifierService } from '../application/services/IntentClassifierService.js';
import type { IntentClassificationInput } from '../domain/entities/IntentClassification.js';
import { RuleBasedIntentClassifier } from '../domain/services/RuleBasedIntentClassifier.js';
import type { IntentClassifierModuleContract } from '../public/contracts/index.js';
import type { IntentClassifierModuleConfig } from './IntentClassifierModuleConfig.js';

export class IntentClassifierModule extends BaseModule implements IntentClassifierModuleContract {
  readonly moduleName = 'intent-classifier' as const;
  readonly service: IntentClassifierService;

  constructor(readonly config: IntentClassifierModuleConfig = {}) {
    super({
      name: 'intent-classifier',
      version: '0.1.0',
      dependencies: [],
    });

    this.service =
      config.service ??
      new IntentClassifierService(
        config.classifier ?? new RuleBasedIntentClassifier(),
      );
  }

  classifyMessage(input: IntentClassificationInput) {
    return this.service.classifyMessage(input);
  }
}
