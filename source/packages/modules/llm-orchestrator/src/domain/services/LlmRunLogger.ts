import type { LlmRunLogEntry } from '../entities/LlmOrchestrator.js';
import { LlmRunLogRepository } from '../../infrastructure/persistence/LlmRunLogRepository.js';

export class LlmRunLogger {
  constructor(private readonly repository: LlmRunLogRepository) {}

  async log(entry: LlmRunLogEntry): Promise<LlmRunLogEntry> {
    return this.repository.appendEntry(entry);
  }
}
