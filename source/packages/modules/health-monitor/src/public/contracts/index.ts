export type { HealthSnapshot } from '../../domain/entities/HealthSnapshot.js';

export interface HealthMonitorModuleContract {
  readonly moduleName: 'health-monitor';
  getHealthSnapshot(groupJid?: string): Promise<import('../../domain/entities/HealthSnapshot.js').HealthSnapshot>;
  getReadiness(groupJid?: string): Promise<{
    readonly ready: boolean;
    readonly status: import('../../domain/entities/HealthSnapshot.js').HealthSnapshot['status'];
  }>;
}
