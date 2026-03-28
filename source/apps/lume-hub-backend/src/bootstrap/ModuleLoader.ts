import { AdminConfigModule } from '@lume-hub/admin-config';
import { AgentRuntimeModule } from '@lume-hub/agent-runtime';
import { AssistantContextModule } from '@lume-hub/assistant-context';
import { AudienceRoutingModule } from '@lume-hub/audience-routing';
import { CodexAuthRouterModule } from '@lume-hub/codex-auth-router';
import { CommandPolicyModule } from '@lume-hub/command-policy';
import { ConversationModule } from '@lume-hub/conversation';
import { DisciplineCatalogModule } from '@lume-hub/discipline-catalog';
import { GroupDirectoryModule } from '@lume-hub/group-directory';
import { GroupKnowledgeModule } from '@lume-hub/group-knowledge';
import { HealthMonitorModule } from '@lume-hub/health-monitor';
import { HostLifecycleModule } from '@lume-hub/host-lifecycle';
import { FastifyHttpServer } from '@lume-hub/http-fastify';
import { InstructionQueueModule } from '@lume-hub/instruction-queue';
import { IntentClassifierModule } from '@lume-hub/intent-classifier';
import { CodexOauthLlmProvider } from '@lume-hub/llm-codex-oauth';
import { OpenAiCompatLlmProvider } from '@lume-hub/llm-openai-compat';
import {
  DeterministicLlmProvider,
  LlmRunLogRepository,
  LlmOrchestratorModule,
  LlmProviderRegistry,
} from '@lume-hub/llm-orchestrator';
import { NotificationJobsModule } from '@lume-hub/notification-jobs';
import { NotificationRulesModule } from '@lume-hub/notification-rules';
import { OwnerControlModule } from '@lume-hub/owner-control';
import { PeopleMemoryModule } from '@lume-hub/people-memory';
import { ScheduleEventsModule } from '@lume-hub/schedule-events';
import { ScheduleWeeksModule } from '@lume-hub/schedule-weeks';
import { SystemPowerModule } from '@lume-hub/system-power';
import { WatchdogModule } from '@lume-hub/watchdog';
import { WeeklyPlannerModule } from '@lume-hub/weekly-planner';
import { BaileysWhatsAppGateway } from '@lume-hub/whatsapp-baileys';
import { WebSocketGateway } from '@lume-hub/ws-fastify';
import { ConversationAuditRepository } from '@lume-hub/conversation';

import type { BackendRuntimeModules } from './BackendRuntime.js';
import { BackendRuntimeStateRepository } from './BackendRuntimeStateRepository.js';
import { resolveBackendRuntimePaths, type BackendRuntimeConfig, type BackendRuntimePaths } from './BackendRuntimeConfig.js';
import { ConversationPipelineRuntime } from './ConversationPipelineRuntime.js';
import { WhatsAppWorkspaceRuntime } from './WhatsAppWorkspaceRuntime.js';

export interface LoadedBackendComposition {
  readonly paths: BackendRuntimePaths;
  readonly modules: BackendRuntimeModules;
  readonly httpServer: FastifyHttpServer;
  readonly webSocketGateway: WebSocketGateway;
  readonly whatsAppWorkspaceRuntime: WhatsAppWorkspaceRuntime;
  readonly conversationPipelineRuntime: ConversationPipelineRuntime;
  readonly diagnosticsRepository: BackendRuntimeStateRepository;
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
    const groupKnowledgeModule = new GroupKnowledgeModule({
      dataRootPath: paths.dataRootPath,
      groupDirectory: groupDirectoryModule,
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
    const weeklyPlannerModule = new WeeklyPlannerModule({
      dataRootPath: paths.dataRootPath,
      adminConfig: adminConfigModule,
      groupDirectory: groupDirectoryModule,
      notificationJobs: notificationJobsModule,
      notificationRules: notificationRulesModule,
      scheduleEvents: scheduleEventsModule,
      scheduleWeeks: scheduleWeeksModule,
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
    const assistantContextModule = new AssistantContextModule({
      dataRootPath: paths.dataRootPath,
      groupDirectory: groupDirectoryModule,
      groupKnowledge: groupKnowledgeModule,
      peopleMemory: peopleMemoryModule,
    });
    const commandPolicyModule = new CommandPolicyModule({
      groupDirectory: groupDirectoryModule,
      peopleMemory: peopleMemoryModule,
      settingsResolver: async () => (await adminConfigModule.getSettings()).commands,
    });
    const intentClassifierModule = new IntentClassifierModule();
    const deterministicProvider = new DeterministicLlmProvider();
    const llmProviderRegistry = new LlmProviderRegistry([
      deterministicProvider,
      new CodexOauthLlmProvider({
        authFilePath: paths.canonicalCodexAuthFile,
        authRouter: codexAuthRouterModule,
        clientVersion: this.config.llmCodexClientVersion,
        modelResolver: async () => (await adminConfigModule.getSettings()).llm.model,
        fetchImpl: this.config.llmFetch,
      }),
      new OpenAiCompatLlmProvider({
        baseUrl: this.config.openAiCompatBaseUrl,
        apiKey: this.config.openAiCompatApiKey,
        defaultModelId: this.config.openAiCompatDefaultModel,
        modelResolver: async () => (await adminConfigModule.getSettings()).llm.model,
        fetchImpl: this.config.llmFetch,
      }),
    ]);
    const llmOrchestratorModule = new LlmOrchestratorModule({
      dataRootPath: paths.dataRootPath,
      providerRegistry: llmProviderRegistry,
      providerResolver: async () => {
        const settings = await adminConfigModule.getSettings();
        return settings.llm.enabled ? settings.llm.provider : deterministicProvider.providerId;
      },
    });
    const ownerControlModule = new OwnerControlModule({
      commandPolicy: commandPolicyModule,
      peopleMemory: peopleMemoryModule,
      groupDirectory: groupDirectoryModule,
      instructionQueue: instructionQueueModule,
    });
    const agentRuntimeModule = new AgentRuntimeModule({
      assistantContext: assistantContextModule,
      audienceRouting: audienceRoutingModule,
      commandPolicy: commandPolicyModule,
      instructionQueue: instructionQueueModule,
      intentClassifier: intentClassifierModule,
      llmOrchestrator: llmOrchestratorModule,
      ownerControl: ownerControlModule,
    });
    const conversationModule = new ConversationModule({
      dataRootPath: paths.dataRootPath,
      agentRuntime: agentRuntimeModule,
      assistantContext: assistantContextModule,
      commandPolicy: commandPolicyModule,
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
      groupKnowledgeModule,
      peopleMemoryModule,
      disciplineCatalogModule,
      audienceRoutingModule,
      scheduleWeeksModule,
      scheduleEventsModule,
      notificationRulesModule,
      notificationJobsModule,
      weeklyPlannerModule,
      instructionQueueModule,
      systemPowerModule,
      codexAuthRouterModule,
      hostLifecycleModule,
      watchdogModule,
      healthMonitorModule,
      assistantContextModule,
      commandPolicyModule,
      intentClassifierModule,
      llmOrchestratorModule,
      ownerControlModule,
      agentRuntimeModule,
      conversationModule,
      modules: [
        adminConfigModule,
        groupDirectoryModule,
        groupKnowledgeModule,
        peopleMemoryModule,
        disciplineCatalogModule,
        audienceRoutingModule,
        scheduleWeeksModule,
        scheduleEventsModule,
        notificationRulesModule,
        notificationJobsModule,
        weeklyPlannerModule,
        instructionQueueModule,
        systemPowerModule,
        codexAuthRouterModule,
        hostLifecycleModule,
        watchdogModule,
        healthMonitorModule,
        assistantContextModule,
        commandPolicyModule,
        intentClassifierModule,
        llmOrchestratorModule,
        ownerControlModule,
        agentRuntimeModule,
        conversationModule,
      ],
    };

    moduleList.push(
      adminConfigModule,
      groupDirectoryModule,
      groupKnowledgeModule,
      peopleMemoryModule,
      disciplineCatalogModule,
      audienceRoutingModule,
      scheduleWeeksModule,
      scheduleEventsModule,
      notificationRulesModule,
      notificationJobsModule,
      weeklyPlannerModule,
      instructionQueueModule,
      systemPowerModule,
      codexAuthRouterModule,
      hostLifecycleModule,
      watchdogModule,
      healthMonitorModule,
      assistantContextModule,
      commandPolicyModule,
      intentClassifierModule,
      llmOrchestratorModule,
      ownerControlModule,
      agentRuntimeModule,
      conversationModule,
    );

    const webSocketGateway = new WebSocketGateway();
    const diagnosticsRepository = new BackendRuntimeStateRepository(paths.backendRuntimeStateFilePath);
    const whatsAppGateway = new BaileysWhatsAppGateway({
      enabled: this.config.whatsappEnabled,
      autoConnect: this.config.whatsappAutoConnect,
      authRootPath: paths.whatsappAuthRootPath,
      socketFactory: this.config.whatsappSocketFactory,
      versionResolver: this.config.whatsappVersionResolver,
    });
    const whatsAppWorkspaceRuntime = new WhatsAppWorkspaceRuntime({
      gateway: whatsAppGateway,
      adminConfig: adminConfigModule,
      groupDirectory: groupDirectoryModule,
      peopleMemory: peopleMemoryModule,
      uiEventPublisher: webSocketGateway.publisher,
    });
    const conversationAuditRepository = new ConversationAuditRepository({
      dataRootPath: paths.dataRootPath,
    });
    const llmRunLogRepository = new LlmRunLogRepository({
      dataRootPath: paths.dataRootPath,
    });
    const httpServer = new FastifyHttpServer({
      modules: {
        adminConfig: adminConfigModule,
        assistantContext: assistantContextModule,
        audienceRouting: audienceRoutingModule,
        conversationLogs: {
          readRecent: async (limit) => {
            const audit = await conversationAuditRepository.read();
            return audit.entries.slice(Math.max(0, audit.entries.length - (limit ?? 20))).reverse();
          },
        },
        codexAuthRouter: codexAuthRouterModule,
        groupDirectory: groupDirectoryModule,
        groupKnowledge: groupKnowledgeModule,
        healthMonitor: healthMonitorModule,
        hostLifecycle: hostLifecycleModule,
        instructionQueue: instructionQueueModule,
        llmLogs: {
          readRecent: async (limit) => {
            const log = await llmRunLogRepository.read();
            return log.entries.slice(Math.max(0, log.entries.length - (limit ?? 20))).reverse();
          },
        },
        peopleMemory: peopleMemoryModule,
        systemPower: systemPowerModule,
        watchdog: watchdogModule,
        weeklyPlanner: weeklyPlannerModule,
        whatsappRuntime: whatsAppWorkspaceRuntime,
        llmOrchestrator: llmOrchestratorModule,
        runtimeDiagnostics: {
          getSnapshot: async () => diagnosticsRepository.readState(),
        },
      },
      uiEventPublisher: webSocketGateway.publisher,
    });
    const conversationPipelineRuntime = new ConversationPipelineRuntime({
      inboundSource: whatsAppWorkspaceRuntime.gateway,
      whatsAppRuntime: whatsAppWorkspaceRuntime,
      peopleMemory: peopleMemoryModule,
      conversation: conversationModule,
      uiEventPublisher: webSocketGateway.publisher,
    });

    return {
      paths,
      modules,
      httpServer,
      webSocketGateway,
      whatsAppWorkspaceRuntime,
      conversationPipelineRuntime,
      diagnosticsRepository,
    };
  }

  loadModuleNames(): readonly string[] {
    return this.load().modules.modules.map((module) => module.name);
  }
}
