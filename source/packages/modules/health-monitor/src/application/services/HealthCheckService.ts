import type { ModuleHealth } from '@lume-hub/contracts';
import type { NotificationJobRepository } from '@lume-hub/notification-jobs';

import type { WatchdogIssueRepository } from '@lume-hub/watchdog';

import type { HealthSnapshot } from '../../domain/entities/HealthSnapshot.js';
import { ModuleHealthAggregator } from '../../domain/services/ModuleHealthAggregator.js';

export type ModuleHealthProvider = () => Promise<readonly ModuleHealth[]>;

export class HealthCheckService {
  constructor(
    private readonly notificationJobRepository: NotificationJobRepository,
    private readonly watchdogIssueRepository: WatchdogIssueRepository,
    private readonly aggregator = new ModuleHealthAggregator(),
    private readonly moduleHealthProvider: ModuleHealthProvider = async () => [],
  ) {}

  async getHealthSnapshot(groupJid?: string): Promise<HealthSnapshot> {
    const jobs = await this.notificationJobRepository.listJobs({
      groupJid,
    });
    const openIssues = await this.watchdogIssueRepository.listIssues({
      groupJid,
      status: 'open',
    });
    const modules = await this.moduleHealthProvider();

    return this.aggregator.aggregate({
      modules,
      jobs: {
        pending: jobs.filter((job) => job.status === 'pending').length,
        waitingConfirmation: jobs.filter((job) => job.status === 'waiting_confirmation').length,
        sent: jobs.filter((job) => job.status === 'sent').length,
      },
      openIssues: openIssues.length,
    });
  }

  async getReadiness(groupJid?: string): Promise<{ readonly ready: boolean; readonly status: HealthSnapshot['status'] }> {
    const snapshot = await this.getHealthSnapshot(groupJid);
    return {
      ready: snapshot.ready,
      status: snapshot.status,
    };
  }
}
