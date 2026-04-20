import type { AdminConfigModule } from '@lume-hub/admin-config';
import type { AgentRuntimeModule } from '@lume-hub/agent-runtime';
import type { AssistantContextModule } from '@lume-hub/assistant-context';
import type { AudienceRoutingModule } from '@lume-hub/audience-routing';
import type { CodexAuthRouterModule } from '@lume-hub/codex-auth-router';
import type { CommandPolicyModule } from '@lume-hub/command-policy';
import type { ConversationModule } from '@lume-hub/conversation';
import type { DeliveryTrackerModule } from '@lume-hub/delivery-tracker';
import type { DisciplineCatalogModule } from '@lume-hub/discipline-catalog';
import type { GroupDirectoryModule } from '@lume-hub/group-directory';
import type { GroupKnowledgeModule } from '@lume-hub/group-knowledge';
import type { HealthMonitorModule } from '@lume-hub/health-monitor';
import type { HostLifecycleModule } from '@lume-hub/host-lifecycle';
import type { FastifyHttpServer, HttpListeningAddress, HttpRequest, HttpResponse } from '@lume-hub/http-fastify';
import type { InstructionQueueModule } from '@lume-hub/instruction-queue';
import type { IntentClassifierModule } from '@lume-hub/intent-classifier';
import type { ApplicationKernel, IModule, ModuleContext, ModuleRegistration } from '@lume-hub/kernel';
import type { LlmOrchestratorModule } from '@lume-hub/llm-orchestrator';
import type { MediaLibraryModule } from '@lume-hub/media-library';
import type { MessageAlertsModule } from '@lume-hub/message-alerts';
import type { NotificationJobsModule } from '@lume-hub/notification-jobs';
import type { NotificationRulesModule } from '@lume-hub/notification-rules';
import type { OwnerControlModule } from '@lume-hub/owner-control';
import type { PeopleMemoryModule } from '@lume-hub/people-memory';
import type { ScheduleEventsModule } from '@lume-hub/schedule-events';
import type { ScheduleDispatcherModule } from '@lume-hub/schedule-dispatcher';
import type { ScheduleWeeksModule } from '@lume-hub/schedule-weeks';
import type { SystemPowerModule } from '@lume-hub/system-power';
import type { AutomationsModule } from '@lume-hub/automations';
import type { WatchdogModule } from '@lume-hub/watchdog';
import type { WeeklyPlannerModule } from '@lume-hub/weekly-planner';
import type { WorkspaceAgentModule } from '@lume-hub/workspace-agent';
import type { WebSocketGateway } from '@lume-hub/ws-fastify';

import type { BackendRuntimePaths } from './BackendRuntimeConfig.js';
import type {
  BackendRuntimeDiagnosticsState,
  BackendRuntimePhase,
} from './BackendRuntimeStateRepository.js';
import { BackendRuntimeStateRepository } from './BackendRuntimeStateRepository.js';
import type { ConversationPipelineRuntime } from './ConversationPipelineRuntime.js';
import type { MessageAlertsRuntime } from './MessageAlertsRuntime.js';
import type { WhatsAppWorkspaceRuntime } from './WhatsAppWorkspaceRuntime.js';

export interface BackendRuntimeModules {
  readonly adminConfigModule: AdminConfigModule;
  readonly groupDirectoryModule: GroupDirectoryModule;
  readonly groupKnowledgeModule: GroupKnowledgeModule;
  readonly peopleMemoryModule: PeopleMemoryModule;
  readonly disciplineCatalogModule: DisciplineCatalogModule;
  readonly audienceRoutingModule: AudienceRoutingModule;
  readonly scheduleWeeksModule: ScheduleWeeksModule;
  readonly scheduleEventsModule: ScheduleEventsModule;
  readonly notificationRulesModule: NotificationRulesModule;
  readonly notificationJobsModule: NotificationJobsModule;
  readonly deliveryTrackerModule: DeliveryTrackerModule;
  readonly scheduleDispatcherModule: ScheduleDispatcherModule;
  readonly weeklyPlannerModule: WeeklyPlannerModule;
  readonly workspaceAgentModule: WorkspaceAgentModule;
  readonly instructionQueueModule: InstructionQueueModule;
  readonly systemPowerModule: SystemPowerModule;
  readonly codexAuthRouterModule: CodexAuthRouterModule;
  readonly hostLifecycleModule: HostLifecycleModule;
  readonly watchdogModule: WatchdogModule;
  readonly healthMonitorModule: HealthMonitorModule;
  readonly assistantContextModule: AssistantContextModule;
  readonly commandPolicyModule: CommandPolicyModule;
  readonly intentClassifierModule: IntentClassifierModule;
  readonly llmOrchestratorModule: LlmOrchestratorModule;
  readonly mediaLibraryModule: MediaLibraryModule;
  readonly messageAlertsModule: MessageAlertsModule;
  readonly automationsModule: AutomationsModule;
  readonly ownerControlModule: OwnerControlModule;
  readonly agentRuntimeModule: AgentRuntimeModule;
  readonly conversationModule: ConversationModule;
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
  readonly instructionQueue: {
    readonly processedInstructions: number;
    readonly processedActions: number;
    readonly failedActions: number;
  };
  readonly watchdog: {
    readonly raised: number;
    readonly resolved: number;
  };
  readonly automations: {
    readonly executed: number;
    readonly failed: number;
  };
  readonly scheduleDispatcher: {
    readonly dueJobsScanned: number;
    readonly waitingConfirmationReviewed: number;
    readonly prepared: number;
    readonly skipped: number;
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
  readonly conversationPipelineRuntime: ConversationPipelineRuntime;
  readonly messageAlertsRuntime: MessageAlertsRuntime;
  readonly diagnosticsRepository: BackendRuntimeStateRepository;
  readonly operationalTickIntervalMs?: number;
}

const DEFAULT_OPERATIONAL_TICK_INTERVAL_MS = 60_000;

export class BackendRuntime {
  private readonly operationalTickIntervalMs: number;
  private operationalTimer?: ReturnType<typeof setInterval>;
  private kernelStarted = false;
  private listeningAddress?: HttpListeningAddress;
  private detachWhatsAppDiagnostics?: () => void;
  private detachDeliveryObservationListener?: () => void;
  private detachDeliveryConfirmationListener?: () => void;
  private startedAt: string | null = null;
  private listeningAt: string | null = null;
  private stoppedAt: string | null = null;
  private lastTickSnapshot: BackendOperationalTickSnapshot | null = null;
  private lastOperationalError: string | null = null;

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

    const now = new Date();
    this.startedAt = this.startedAt ?? now.toISOString();
    this.stoppedAt = null;
    await this.writeDiagnostics('starting', now);

    await this.options.kernel.start();
    this.kernelStarted = true;
    await this.options.whatsAppWorkspaceRuntime.start();
    await this.options.messageAlertsRuntime.start();
    await this.options.conversationPipelineRuntime.start();
    this.detachDeliveryObservationListener = this.options.whatsAppWorkspaceRuntime.gateway.subscribeOutboundObservation((signal) => {
      void this.options.modules.deliveryTrackerModule
        .registerObservation(signal, { groupJid: signal.chatJid })
        .catch(() => undefined);
    });
    this.detachDeliveryConfirmationListener = this.options.whatsAppWorkspaceRuntime.gateway.subscribeOutboundConfirmation((signal) => {
      void this.options.modules.deliveryTrackerModule
        .registerConfirmation(signal, { groupJid: signal.chatJid })
        .catch(() => undefined);
    });
    this.detachWhatsAppDiagnostics = this.options.whatsAppWorkspaceRuntime.gateway.subscribeRuntime(() => {
      void this.writeDiagnostics(this.lastOperationalError ? 'degraded' : 'running', new Date()).catch(() => undefined);
    });

    try {
      await this.runOperationalTick();
      this.operationalTimer = setInterval(() => {
        void this.runOperationalTick();
      }, this.operationalTickIntervalMs);
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    const now = new Date();

    if (this.operationalTimer) {
      clearInterval(this.operationalTimer);
      this.operationalTimer = undefined;
    }

    this.detachWhatsAppDiagnostics?.();
    this.detachWhatsAppDiagnostics = undefined;
    this.detachDeliveryObservationListener?.();
    this.detachDeliveryObservationListener = undefined;
    this.detachDeliveryConfirmationListener?.();
    this.detachDeliveryConfirmationListener = undefined;

    await this.options.conversationPipelineRuntime.stop();
    await this.options.messageAlertsRuntime.stop();
    await this.options.whatsAppWorkspaceRuntime.stop();
    await this.options.webSocketGateway.close();
    await this.options.httpServer.close();
    this.listeningAddress = undefined;

    if (!this.kernelStarted) {
      this.listeningAddress = undefined;
      this.listeningAt = null;
      this.stoppedAt = now.toISOString();
      await this.writeDiagnostics('stopped', now);
      return;
    }

    this.kernelStarted = false;
    await this.options.kernel.stop();
    this.listeningAddress = undefined;
    this.listeningAt = null;
    this.stoppedAt = now.toISOString();
    await this.writeDiagnostics('stopped', now);
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

    this.listeningAt = new Date().toISOString();
    await this.writeDiagnostics(this.lastOperationalError ? 'degraded' : 'running', new Date());
    return this.listeningAddress;
  }

  getListeningAddress(): HttpListeningAddress | null {
    return this.listeningAddress ?? null;
  }

  async performOperationalTick(now = new Date()): Promise<BackendOperationalTickSnapshot> {
    try {
      await this.options.modules.systemPowerModule.evaluatePowerPolicy();
      const scheduleDispatcherTick = await this.options.modules.scheduleDispatcherModule.tick({
        now,
      });
      const instructionQueueTick = await this.options.modules.instructionQueueModule.tickWorker(now);
      const automationTick = await this.options.modules.automationsModule.tick(
        {
          sendText: (input) => this.options.whatsAppWorkspaceRuntime.sendText(input),
        },
        now,
      );
      const watchdogResult = await this.options.modules.watchdogModule.tick({
        now,
      });
      const hostStatus = await this.options.modules.hostLifecycleModule.publishHeartbeat({
        now,
        lastError: null,
      });

      return {
        performedAt: now.toISOString(),
        instructionQueue: {
          processedInstructions: instructionQueueTick.processedInstructionIds.length,
          processedActions: instructionQueueTick.processedActionIds.length,
          failedActions: instructionQueueTick.failedActionIds.length,
        },
        watchdog: {
          raised: watchdogResult.raised.length,
          resolved: watchdogResult.resolved.length,
        },
        automations: {
          executed: automationTick.executedCount,
          failed: automationTick.failedCount,
        },
        scheduleDispatcher: {
          dueJobsScanned: scheduleDispatcherTick.dueJobsScanned,
          waitingConfirmationReviewed: scheduleDispatcherTick.waitingConfirmationReviewed,
          prepared: scheduleDispatcherTick.results.filter((result) => result.status === 'prepared').length,
          skipped: scheduleDispatcherTick.results.filter((result) => result.status === 'skipped').length,
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

  async getRuntimeDiagnostics(): Promise<BackendRuntimeDiagnosticsState> {
    return this.options.diagnosticsRepository.readState(this.createFallbackDiagnosticsState());
  }

  private async runOperationalTick(): Promise<void> {
    try {
      const snapshot = await this.performOperationalTick();
      this.lastTickSnapshot = snapshot;
      this.lastOperationalError = null;
      await this.writeDiagnostics('running', new Date());
    } catch (error) {
      this.lastOperationalError = toErrorMessage(error);
      await this.writeDiagnostics('degraded', new Date());
      console.error('Backend operational tick failed.', error);
    }
  }

  private async writeDiagnostics(phase: BackendRuntimePhase, now: Date): Promise<void> {
    const state = await this.createDiagnosticsState(phase, now);
    await this.options.diagnosticsRepository.saveState(state);
  }

  private async createDiagnosticsState(
    phase: BackendRuntimePhase,
    now: Date,
  ): Promise<BackendRuntimeDiagnosticsState> {
    const fallback = this.createFallbackDiagnosticsState(now, phase);

    if (!this.kernelStarted) {
      return fallback;
    }

    const [healthSnapshot, whatsAppRuntime, hostStatus] = await Promise.all([
      this.options.modules.healthMonitorModule.getHealthSnapshot().catch(() => null),
      this.options.whatsAppWorkspaceRuntime.getRuntimeSnapshot().catch(() => null),
      this.options.modules.hostLifecycleModule.getHostCompanionStatus().catch(() => null),
    ]);

    if (!healthSnapshot || !whatsAppRuntime || !hostStatus) {
      return {
        ...fallback,
        phase: phase === 'running' ? 'degraded' : phase,
        operational: {
          ...fallback.operational,
          lastError: this.lastOperationalError ?? fallback.operational.lastError,
        },
      };
    }

    return {
      ...fallback,
      readiness: {
        ready: healthSnapshot.ready,
        status: healthSnapshot.status,
      },
      health: {
        status: healthSnapshot.status,
        jobs: {
          pending: healthSnapshot.jobs.pending,
          waitingConfirmation: healthSnapshot.jobs.waitingConfirmation,
          sent: healthSnapshot.jobs.sent,
        },
        watchdog: {
          openIssues: healthSnapshot.watchdog.openIssues,
        },
        modules: healthSnapshot.modules.map((module) => ({
          name: typeof module.details?.module === 'string' ? module.details.module : 'unknown',
          status: module.status,
          details: module.details ?? null,
        })),
      },
      host: {
        lastHeartbeatAt: hostStatus.runtime.lastHeartbeatAt,
        lastError: hostStatus.runtime.lastError,
      },
      whatsapp: {
        session: {
          phase: whatsAppRuntime.session.phase,
          connected: whatsAppRuntime.session.connected,
          loginRequired: whatsAppRuntime.session.loginRequired,
          lastConnectedAt: whatsAppRuntime.session.lastConnectedAt,
          lastDisconnectAt: whatsAppRuntime.session.lastDisconnectAt,
          lastDisconnectReason: whatsAppRuntime.session.lastDisconnectReason,
          lastError: whatsAppRuntime.session.lastError,
        },
        discoveredGroups: whatsAppRuntime.groups.length,
        discoveredConversations: whatsAppRuntime.conversations.length,
      },
      webSocket: {
        sessionCount: this.options.webSocketGateway.getSessionCount(),
      },
    };
  }

  private createFallbackDiagnosticsState(
    now = new Date(),
    phase: BackendRuntimePhase = this.lastOperationalError ? 'degraded' : this.kernelStarted ? 'running' : 'stopped',
  ): BackendRuntimeDiagnosticsState {
    const performedAt = this.lastTickSnapshot?.performedAt ?? null;

    return {
      schemaVersion: 1,
      stateFilePath: this.options.diagnosticsRepository.getStateFilePath(),
      phase,
      startedAt: this.startedAt,
      listeningAt: this.listeningAt,
      stoppedAt: phase === 'stopped' ? (this.stoppedAt ?? now.toISOString()) : this.stoppedAt,
      updatedAt: now.toISOString(),
      baseUrl: this.baseUrl,
      http: {
        host: this.paths.httpHost,
        port: this.paths.httpPort,
        webSocketPath: this.paths.webSocketPath,
      },
      frontend: {
        defaultMode: this.paths.frontendDefaultMode,
        distRootPath: this.paths.webDistRootPath,
      },
      moduleGraph: {
        moduleCount: this.moduleGraph.loadOrder.length,
        loadOrder: this.moduleGraph.loadOrder,
      },
      readiness: {
        ready: false,
        status: phase === 'starting' ? 'starting' : phase === 'stopped' ? 'stopped' : 'degraded',
      },
      health: {
        status: phase === 'starting' ? 'starting' : phase === 'running' ? 'healthy' : phase,
        jobs: {
          pending: 0,
          waitingConfirmation: 0,
          sent: 0,
        },
        watchdog: {
          openIssues: 0,
        },
        modules: [],
      },
      operational: {
        lastTickAt: performedAt,
        lastError: this.lastOperationalError,
        watchdogRaised: this.lastTickSnapshot?.watchdog.raised ?? 0,
        watchdogResolved: this.lastTickSnapshot?.watchdog.resolved ?? 0,
      },
      host: {
        lastHeartbeatAt: this.lastTickSnapshot?.hostHeartbeatAt ?? null,
        lastError: this.lastOperationalError,
      },
      whatsapp: {
        session: {
          phase: this.kernelStarted ? 'idle' : 'closed',
          connected: false,
          loginRequired: false,
          lastConnectedAt: null,
          lastDisconnectAt: null,
          lastDisconnectReason: null,
          lastError: this.lastOperationalError,
        },
        discoveredGroups: 0,
        discoveredConversations: 0,
      },
      webSocket: {
        sessionCount: this.options.webSocketGateway.getSessionCount(),
      },
    };
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
