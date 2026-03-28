import type { AdminConfigModule } from '@lume-hub/admin-config';
import type { AudienceRoutingModule } from '@lume-hub/audience-routing';
import type { CodexAuthRouterModule } from '@lume-hub/codex-auth-router';
import type { DisciplineCatalogModule } from '@lume-hub/discipline-catalog';
import type { GroupDirectoryModule } from '@lume-hub/group-directory';
import type { HealthMonitorModule } from '@lume-hub/health-monitor';
import type { HostLifecycleModule } from '@lume-hub/host-lifecycle';
import type { FastifyHttpServer, HttpListeningAddress, HttpRequest, HttpResponse } from '@lume-hub/http-fastify';
import type { InstructionQueueModule } from '@lume-hub/instruction-queue';
import type { ApplicationKernel, IModule, ModuleContext, ModuleRegistration } from '@lume-hub/kernel';
import type { NotificationJobsModule } from '@lume-hub/notification-jobs';
import type { NotificationRulesModule } from '@lume-hub/notification-rules';
import type { PeopleMemoryModule } from '@lume-hub/people-memory';
import type { ScheduleEventsModule } from '@lume-hub/schedule-events';
import type { ScheduleWeeksModule } from '@lume-hub/schedule-weeks';
import type { SystemPowerModule } from '@lume-hub/system-power';
import type { WatchdogModule } from '@lume-hub/watchdog';
import type { WebSocketGateway } from '@lume-hub/ws-fastify';

import type { BackendRuntimePaths } from './BackendRuntimeConfig.js';
import type { WhatsAppWorkspaceRuntime } from './WhatsAppWorkspaceRuntime.js';

export interface BackendRuntimeModules {
  readonly adminConfigModule: AdminConfigModule;
  readonly groupDirectoryModule: GroupDirectoryModule;
  readonly peopleMemoryModule: PeopleMemoryModule;
  readonly disciplineCatalogModule: DisciplineCatalogModule;
  readonly audienceRoutingModule: AudienceRoutingModule;
  readonly scheduleWeeksModule: ScheduleWeeksModule;
  readonly scheduleEventsModule: ScheduleEventsModule;
  readonly notificationRulesModule: NotificationRulesModule;
  readonly notificationJobsModule: NotificationJobsModule;
  readonly instructionQueueModule: InstructionQueueModule;
  readonly systemPowerModule: SystemPowerModule;
  readonly codexAuthRouterModule: CodexAuthRouterModule;
  readonly hostLifecycleModule: HostLifecycleModule;
  readonly watchdogModule: WatchdogModule;
  readonly healthMonitorModule: HealthMonitorModule;
  readonly modules: readonly IModule[];
}

export interface BackendModuleGraphNode {
  readonly moduleName: string;
  readonly dependencies: readonly string[];
  readonly optionalDependencies: readonly string[];
}

export interface BackendModuleGraph {
  readonly nodes: readonly BackendModuleGraphNode[];
  readonly registrations: readonly ModuleRegistration[];
  readonly loadOrder: readonly string[];
}

export interface BackendOperationalTickSnapshot {
  readonly performedAt: string;
  readonly watchdog: {
    readonly raised: number;
    readonly resolved: number;
  };
  readonly hostHeartbeatAt: string | null;
}

export interface BackendRuntimeOptions {
  readonly kernel: ApplicationKernel;
  readonly httpServer: FastifyHttpServer;
  readonly webSocketGateway: WebSocketGateway;
  readonly modules: BackendRuntimeModules;
  readonly moduleGraph: BackendModuleGraph;
  readonly paths: BackendRuntimePaths;
  readonly whatsAppWorkspaceRuntime: WhatsAppWorkspaceRuntime;
  readonly operationalTickIntervalMs?: number;
}

const DEFAULT_OPERATIONAL_TICK_INTERVAL_MS = 60_000;

export class BackendRuntime {
  private readonly operationalTickIntervalMs: number;
  private operationalTimer?: ReturnType<typeof setInterval>;
  private kernelStarted = false;
  private listeningAddress?: HttpListeningAddress;

  constructor(private readonly options: BackendRuntimeOptions) {
    this.operationalTickIntervalMs = Math.max(
      1_000,
      options.operationalTickIntervalMs ?? DEFAULT_OPERATIONAL_TICK_INTERVAL_MS,
    );
  }

  get kernel(): ApplicationKernel {
    return this.options.kernel;
  }

  get httpServer(): FastifyHttpServer {
    return this.options.httpServer;
  }

  get webSocketGateway(): WebSocketGateway {
    return this.options.webSocketGateway;
  }

  get modules(): BackendRuntimeModules {
    return this.options.modules;
  }

  get moduleGraph(): BackendModuleGraph {
    return this.options.moduleGraph;
  }

  get paths(): BackendRuntimePaths {
    return this.options.paths;
  }

  get baseUrl(): string | null {
    return this.listeningAddress?.origin ?? null;
  }

  async start(): Promise<void> {
    if (this.kernelStarted) {
      return;
    }

    await this.options.kernel.start();
    this.kernelStarted = true;
    await this.options.whatsAppWorkspaceRuntime.start();

    try {
      await this.performOperationalTick();
      this.operationalTimer = setInterval(() => {
        void this.performOperationalTick().catch((error) => {
          console.error('Backend operational tick failed.', error);
        });
      }, this.operationalTickIntervalMs);
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.operationalTimer) {
      clearInterval(this.operationalTimer);
      this.operationalTimer = undefined;
    }

    await this.options.whatsAppWorkspaceRuntime.stop();
    await this.options.webSocketGateway.close();
    await this.options.httpServer.close();
    this.listeningAddress = undefined;

    if (!this.kernelStarted) {
      return;
    }

    this.kernelStarted = false;
    await this.options.kernel.stop();
  }

  async inject<T = unknown>(request: HttpRequest): Promise<HttpResponse<T>> {
    return this.options.httpServer.inject<T>(request);
  }

  listModules(): readonly IModule[] {
    return this.options.kernel.listModules();
  }

  getContext(): ModuleContext {
    return this.options.kernel.getContext();
  }

  async listen(): Promise<HttpListeningAddress> {
    if (this.listeningAddress) {
      return this.listeningAddress;
    }

    this.listeningAddress = await this.options.httpServer.listen({
      host: this.paths.httpHost,
      port: this.paths.httpPort,
      staticSite: {
        rootPath: this.paths.webDistRootPath,
        bootConfig: {
          defaultMode: this.paths.frontendDefaultMode,
          webSocketPath: this.paths.webSocketPath,
        },
      },
      onServerCreated: async (server) => {
        this.options.webSocketGateway.attach(server, {
          path: this.paths.webSocketPath,
        });
      },
    });

    return this.listeningAddress;
  }

  getListeningAddress(): HttpListeningAddress | null {
    return this.listeningAddress ?? null;
  }

  async performOperationalTick(now = new Date()): Promise<BackendOperationalTickSnapshot> {
    try {
      await this.options.modules.systemPowerModule.evaluatePowerPolicy();
      const watchdogResult = await this.options.modules.watchdogModule.tick({
        now,
      });
      const hostStatus = await this.options.modules.hostLifecycleModule.publishHeartbeat({
        now,
        lastError: null,
      });

      return {
        performedAt: now.toISOString(),
        watchdog: {
          raised: watchdogResult.raised.length,
          resolved: watchdogResult.resolved.length,
        },
        hostHeartbeatAt: hostStatus.runtime.lastHeartbeatAt,
      };
    } catch (error) {
      await this.options.modules.hostLifecycleModule
        .publishHeartbeat({
          now,
          lastError: toErrorMessage(error),
        })
        .catch(() => undefined);

      throw error;
    }
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
