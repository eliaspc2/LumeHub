import { AdminConfigModule } from '@lume-hub/admin-config';
import { AudienceRoutingModule } from '@lume-hub/audience-routing';
import { CodexAuthRouterModule } from '@lume-hub/codex-auth-router';
import { DisciplineCatalogModule } from '@lume-hub/discipline-catalog';
import { GroupDirectoryModule } from '@lume-hub/group-directory';
import { HealthMonitorModule } from '@lume-hub/health-monitor';
import { HostLifecycleModule } from '@lume-hub/host-lifecycle';
import { FastifyHttpServer } from '@lume-hub/http-fastify';
import { InstructionQueueModule } from '@lume-hub/instruction-queue';
import { NotificationJobsModule } from '@lume-hub/notification-jobs';
import { NotificationRulesModule } from '@lume-hub/notification-rules';
import { PeopleMemoryModule } from '@lume-hub/people-memory';
import { ScheduleEventsModule } from '@lume-hub/schedule-events';
import { ScheduleWeeksModule } from '@lume-hub/schedule-weeks';
import { SystemPowerModule } from '@lume-hub/system-power';
import { WatchdogModule } from '@lume-hub/watchdog';
import { WebSocketGateway } from '@lume-hub/ws-fastify';

import type { BackendRuntimeModules } from './BackendRuntime.js';
import { resolveBackendRuntimePaths, type BackendRuntimeConfig, type BackendRuntimePaths } from './BackendRuntimeConfig.js';

export interface LoadedBackendComposition {
  readonly paths: BackendRuntimePaths;
  readonly modules: BackendRuntimeModules;
  readonly httpServer: FastifyHttpServer;
  readonly webSocketGateway: WebSocketGateway;
}

export class ModuleLoader {
  constructor(private readonly config: BackendRuntimeConfig = {}) {}

  load(): LoadedBackendComposition {
    const paths = resolveBackendRuntimePaths(this.config);
    const adminConfigModule = new AdminConfigModule({
      settingsFilePath: paths.settingsFilePath,
    });
    const groupDirectoryModule = new GroupDirectoryModule({
      dataRootPath: paths.dataRootPath,
      groupSeedFilePath: paths.groupSeedFilePath,
    });
    const peopleMemoryModule = new PeopleMemoryModule({
      peopleFilePath: paths.peopleFilePath,
    });
    const disciplineCatalogModule = new DisciplineCatalogModule({
      catalogFilePath: paths.catalogFilePath,
    });
    const audienceRoutingModule = new AudienceRoutingModule({
      dataRootPath: paths.dataRootPath,
      groupSeedFilePath: paths.groupSeedFilePath,
      catalogFilePath: paths.catalogFilePath,
      peopleFilePath: paths.peopleFilePath,
      rulesFilePath: paths.rulesFilePath,
      groupDirectory: groupDirectoryModule,
      disciplineCatalog: disciplineCatalogModule,
      peopleMemory: peopleMemoryModule,
    });
    const scheduleWeeksModule = new ScheduleWeeksModule({
      dataRootPath: paths.dataRootPath,
      clock: this.config.clock,
    });
    const scheduleEventsModule = new ScheduleEventsModule({
      dataRootPath: paths.dataRootPath,
    });
    const notificationRulesModule = new NotificationRulesModule({
      dataRootPath: paths.dataRootPath,
      scheduleEventService: scheduleEventsModule.service,
    });
    const notificationJobsModule = new NotificationJobsModule({
      dataRootPath: paths.dataRootPath,
      clock: this.config.clock,
      scheduleEventService: scheduleEventsModule.service,
      notificationRuleService: notificationRulesModule.service,
    });
    const instructionQueueModule = new InstructionQueueModule({
      dataRootPath: paths.dataRootPath,
      queueFilePath: paths.queueFilePath,
    });
    const systemPowerModule = new SystemPowerModule({
      clock: this.config.clock,
      stateFilePath: paths.powerStateFilePath,
      inhibitorStatePath: paths.inhibitorStatePath,
    });
    const codexAuthRouterModule = new CodexAuthRouterModule({
      canonicalAuthFilePath: paths.canonicalCodexAuthFile,
      stateFilePath: paths.codexAuthRouterStateFilePath,
      backupDirectoryPath: paths.codexAuthRouterBackupDirectoryPath,
      sourceAccounts: this.config.codexAuthSources,
      startByPreparingAuth: this.config.startByPreparingCodexAuth ?? false,
    });
    const hostLifecycleModule = new HostLifecycleModule({
      clock: this.config.clock,
      codexAuthFile: paths.codexAuthFile,
      canonicalCodexAuthFile: paths.canonicalCodexAuthFile,
      stateFilePath: paths.hostStateFilePath,
      backendStateFilePath: paths.backendStateFilePath,
      systemdUserPath: paths.systemdUserPath,
      serviceName: paths.hostServiceName,
      workingDirectory: paths.hostWorkingDirectory,
      execStart: paths.hostExecStart,
      publishHeartbeatOnStart: this.config.hostPublishHeartbeatOnStart,
      powerStatusProvider: async () => {
        const status = await systemPowerModule.getPowerStatus();

        return {
          policyMode: status.policy.mode,
          inhibitorActive: status.inhibitorActive,
          leaseId: status.activeLease?.leaseId ?? null,
          explanation: status.explanation,
        };
      },
      authRouterStatusProvider: async () => {
        const status = await codexAuthRouterModule.getStatus();

        return {
          canonicalAuthFilePath: status.canonicalAuthFilePath,
          currentAccountId: status.currentSelection?.accountId ?? null,
          currentSourceFilePath: status.currentSelection?.sourceFilePath ?? null,
          accountCount: status.accountCount,
          lastSwitchAt: status.lastSwitchAt,
        };
      },
    });
    const watchdogModule = new WatchdogModule({
      dataRootPath: paths.dataRootPath,
      clock: this.config.clock,
    });

    const moduleList: BackendRuntimeModules['modules'][number][] = [];
    const healthMonitorModule = new HealthMonitorModule({
      dataRootPath: paths.dataRootPath,
      moduleHealthProvider: async () =>
        Promise.all(
          moduleList.map(async (module) => {
            const health = await module.health();

            return {
              status: health.status,
              details: {
                module: module.name,
                ...(health.details ?? {}),
              },
            };
          }),
        ),
    });
    const modules: BackendRuntimeModules = {
      adminConfigModule,
      groupDirectoryModule,
      peopleMemoryModule,
      disciplineCatalogModule,
      audienceRoutingModule,
      scheduleWeeksModule,
      scheduleEventsModule,
      notificationRulesModule,
      notificationJobsModule,
      instructionQueueModule,
      systemPowerModule,
      codexAuthRouterModule,
      hostLifecycleModule,
      watchdogModule,
      healthMonitorModule,
      modules: [
        adminConfigModule,
        groupDirectoryModule,
        peopleMemoryModule,
        disciplineCatalogModule,
        audienceRoutingModule,
        scheduleWeeksModule,
        scheduleEventsModule,
        notificationRulesModule,
        notificationJobsModule,
        instructionQueueModule,
        systemPowerModule,
        codexAuthRouterModule,
        hostLifecycleModule,
        watchdogModule,
        healthMonitorModule,
      ],
    };

    moduleList.push(
      adminConfigModule,
      groupDirectoryModule,
      peopleMemoryModule,
      disciplineCatalogModule,
      audienceRoutingModule,
      scheduleWeeksModule,
      scheduleEventsModule,
      notificationRulesModule,
      notificationJobsModule,
      instructionQueueModule,
      systemPowerModule,
      codexAuthRouterModule,
      hostLifecycleModule,
      watchdogModule,
      healthMonitorModule,
    );

    const webSocketGateway = new WebSocketGateway();
    const httpServer = new FastifyHttpServer({
      modules: {
        adminConfig: adminConfigModule,
        audienceRouting: audienceRoutingModule,
        codexAuthRouter: codexAuthRouterModule,
        groupDirectory: groupDirectoryModule,
        healthMonitor: healthMonitorModule,
        hostLifecycle: hostLifecycleModule,
        instructionQueue: instructionQueueModule,
        peopleMemory: peopleMemoryModule,
        systemPower: systemPowerModule,
        watchdog: watchdogModule,
      },
      uiEventPublisher: webSocketGateway.publisher,
    });

    return {
      paths,
      modules,
      httpServer,
      webSocketGateway,
    };
  }

  loadModuleNames(): readonly string[] {
    return this.load().modules.modules.map((module) => module.name);
  }
}
