import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server as NodeHttpServer, type ServerResponse } from 'node:http';
import { access, readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

import {
  DEFAULT_ADMIN_SETTINGS,
  type AdminConfigModuleContract,
  type AdminSettings,
  type AutomationsSettings,
  type CommandsPolicySettings,
  type LlmRuntimeStatusSnapshot,
  type MessageAlertsSettings,
  type WhatsAppSettings,
} from '@lume-hub/admin-config';
import type { AgentRuntimeModuleContract } from '@lume-hub/agent-runtime';
import type { AssistantContextModuleContract } from '@lume-hub/assistant-context';
import type { AudienceRoutingModuleContract } from '@lume-hub/audience-routing';
import type { CodexAuthRouterModuleContract } from '@lume-hub/codex-auth-router';
import type { ConversationAuditRecord } from '@lume-hub/conversation';
import {
  DEFAULT_GROUP_CALENDAR_ACCESS_POLICY,
  type CalendarAccessMode,
  type GroupCalendarAccessPolicy,
  type GroupDirectoryModuleContract,
} from '@lume-hub/group-directory';
import type { GroupKnowledgeModuleContract } from '@lume-hub/group-knowledge';
import type { HealthMonitorModuleContract } from '@lume-hub/health-monitor';
import type { HostLifecycleModuleContract } from '@lume-hub/host-lifecycle';
import type { DistributionContentInput, Instruction, InstructionQueueModuleContract } from '@lume-hub/instruction-queue';
import type { LlmChatInput, LlmOrchestratorModuleContract, LlmRunLogEntry } from '@lume-hub/llm-orchestrator';
import type { MediaLibraryModuleContract } from '@lume-hub/media-library';
import type { MessageAlertsModuleContract } from '@lume-hub/message-alerts';
import type { PeopleMemoryModuleContract, Person, PersonRole, PersonUpsertInput } from '@lume-hub/people-memory';
import type { SystemPowerModuleContract } from '@lume-hub/system-power';
import type { AutomationsModuleContract } from '@lume-hub/automations';
import type { WatchdogModuleContract } from '@lume-hub/watchdog';
import type {
  LegacyScheduleImportInput,
  WeeklyPlannerModuleContract,
  WeeklyPlannerUpsertInput,
} from '@lume-hub/weekly-planner';
import type { WorkspaceAgentModuleContract } from '@lume-hub/workspace-agent';
import type { WhatsAppRuntimeSnapshot } from '@lume-hub/whatsapp-baileys';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpRequest {
  readonly method: HttpMethod;
  readonly path: string;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
}

export interface HttpResponse<T = unknown> {
  readonly statusCode: number;
  readonly body: T;
}

export interface HttpApiRequestContext {
  readonly requestId: string;
  readonly receivedAt: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly query: Record<string, string | readonly string[]>;
  readonly params: Record<string, string>;
  readonly body: unknown;
}

export type HttpApiHandler = (context: HttpApiRequestContext) => Promise<unknown>;

export interface RegisteredRoute {
  readonly method: HttpMethod;
  readonly path: string;
  readonly handler: HttpApiHandler;
}

export interface UiEventPublisherLike {
  publish<TPayload>(topic: string, payload: TPayload, now?: Date): {
    readonly eventId: string;
    readonly topic: string;
    readonly emittedAt: string;
    readonly payload: TPayload;
  };
}

export interface HttpApiModules {
  readonly adminConfig: Pick<AdminConfigModuleContract, 'getSettings' | 'getLlmRuntimeStatus' | 'updateUiSettings'> &
    Partial<
      Pick<
        AdminConfigModuleContract,
        'updateAlertsSettings' | 'updateAutomationSettings' | 'updateCommandsSettings' | 'updateLlmSettings' | 'updateWhatsAppSettings'
      >
    >;
  readonly agentRuntime?: Pick<AgentRuntimeModuleContract, 'applyScheduleAction' | 'previewScheduleApply'>;
  readonly assistantContext?: Pick<AssistantContextModuleContract, 'buildChatContext'>;
  readonly audienceRouting: Pick<
    AudienceRoutingModuleContract,
    'listSenderAudienceRules' | 'upsertSenderAudienceRule' | 'previewDistributionPlan'
  >;
  readonly conversationLogs?: {
    readRecent(limit?: number): Promise<readonly ConversationAuditRecord[]>;
  };
  readonly codexAuthRouter?: Pick<CodexAuthRouterModuleContract, 'prepareAuthForRequest' | 'forceSwitch' | 'getStatus'>;
  readonly groupDirectory: Pick<
    GroupDirectoryModuleContract,
    'listGroups' | 'replaceGroupOwners' | 'updateCalendarAccessPolicy' | 'getGroupLlmInstructions' | 'updateGroupLlmInstructions'
  >;
  readonly groupKnowledge?: Pick<GroupKnowledgeModuleContract, 'getIndex' | 'upsertDocument' | 'deleteDocument'>;
  readonly healthMonitor: Pick<HealthMonitorModuleContract, 'getHealthSnapshot' | 'getReadiness'>;
  readonly hostLifecycle: Pick<
    HostLifecycleModuleContract,
    'enableStartWithSystem' | 'disableStartWithSystem' | 'getHostCompanionStatus'
  >;
  readonly instructionQueue: Pick<
    InstructionQueueModuleContract,
    'enqueueDistributionPlan' | 'listInstructions' | 'retryInstruction'
  >;
  readonly llmLogs?: {
    readRecent(limit?: number): Promise<readonly LlmRunLogEntry[]>;
  };
  readonly llmRuntime?: {
    getStatus(): Promise<LlmRuntimeStatusSnapshot>;
  };
  readonly llmOrchestrator?: Pick<LlmOrchestratorModuleContract, 'chat' | 'listModels' | 'refreshModels'>;
  readonly mediaLibrary?: Pick<MediaLibraryModuleContract, 'getLibrary' | 'listAssets' | 'getAsset'>;
  readonly migrationReadiness?: {
    getSnapshot(): Promise<unknown>;
  };
  readonly messageAlerts?: Pick<
    MessageAlertsModuleContract,
    'applyLegacyImport' | 'listRecentMatches' | 'listRules' | 'previewLegacyImport'
  >;
  readonly automations?: Pick<
    AutomationsModuleContract,
    'applyLegacyImport' | 'listDefinitions' | 'listRecentRuns' | 'previewLegacyImport'
  >;
  readonly peopleMemory?: Pick<PeopleMemoryModuleContract, 'listPeople' | 'upsertByIdentifiers' | 'updatePersonRoles'>;
  readonly runtimeDiagnostics?: {
    getSnapshot(): Promise<unknown>;
  };
  readonly systemPower: Pick<SystemPowerModuleContract, 'getPowerStatus' | 'updatePowerPolicy'>;
  readonly watchdog: Pick<WatchdogModuleContract, 'listIssues' | 'resolveIssue'>;
  readonly weeklyPlanner?: Pick<
    WeeklyPlannerModuleContract,
    | 'applyLegacyScheduleImport'
    | 'deleteSchedule'
    | 'getWeekSnapshot'
    | 'listLegacyScheduleFiles'
    | 'previewLegacyScheduleImport'
    | 'saveSchedule'
  >;
  readonly workspaceAgent?: Pick<WorkspaceAgentModuleContract, 'getStatus' | 'listRuns' | 'readFile' | 'run' | 'searchFiles'>;
  readonly whatsappRuntime?: {
    getRuntimeSnapshot(): Promise<WhatsAppRuntimeSnapshot>;
    refreshWorkspace(): Promise<WhatsAppRuntimeSnapshot>;
    applySettings(settings: Partial<WhatsAppSettings>): Promise<WhatsAppRuntimeSnapshot>;
    sendText(input: {
      readonly chatJid: string;
      readonly text: string;
      readonly idempotencyKey?: string;
      readonly messageId?: string;
    }): Promise<{
      readonly messageId: string;
      readonly chatJid: string;
      readonly acceptedAt: string;
      readonly idempotencyKey?: string;
    }>;
  };
}

export interface FastifyHttpServerConfig {
  readonly modules: HttpApiModules;
  readonly uiEventPublisher?: UiEventPublisherLike;
  readonly routeRegistrar?: RouteRegistrar;
  readonly requestContextFactory?: RequestContextFactory;
  readonly errorHandler?: ApiErrorHandler;
}

export interface HttpFrontendBootConfig {
  readonly defaultMode?: 'demo' | 'live';
  readonly apiBaseUrl?: string;
  readonly webSocketPath?: string;
}

export interface HttpStaticSiteConfig {
  readonly rootPath: string;
  readonly bootConfig?: HttpFrontendBootConfig;
}

export interface HttpListenOptions {
  readonly host: string;
  readonly port: number;
  readonly staticSite?: HttpStaticSiteConfig;
  readonly onServerCreated?: (server: NodeHttpServer) => void | Promise<void>;
}

export interface HttpListeningAddress {
  readonly host: string;
  readonly port: number;
  readonly origin: string;
}

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export class RequestContextFactory {
  create(request: HttpRequest, params: Record<string, string>, now = new Date()): HttpApiRequestContext {
    const url = new URL(request.path, 'http://lume-hub.local');

    return {
      requestId: `http-request-${randomUUID()}`,
      receivedAt: now.toISOString(),
      method: request.method,
      path: url.pathname,
      headers: request.headers ?? {},
      query: parseQuery(url.searchParams),
      params,
      body: request.body,
    };
  }
}

export class ApiErrorHandler {
  toResponse(error: unknown): HttpResponse<{ error: string }> {
    if (error instanceof ApiError) {
      return {
        statusCode: error.statusCode,
        body: {
          error: error.message,
        },
      };
    }

    return {
      statusCode: 500,
      body: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export class FastifyHttpServer {
  private readonly routes: RegisteredRoute[] = [];
  private readonly requestContextFactory: RequestContextFactory;
  private readonly errorHandler: ApiErrorHandler;
  private nodeServer?: NodeHttpServer;
  private staticSite?: HttpStaticSiteConfig;
  private listeningAddress?: HttpListeningAddress;

  constructor(readonly config: FastifyHttpServerConfig) {
    this.requestContextFactory = config.requestContextFactory ?? new RequestContextFactory();
    this.errorHandler = config.errorHandler ?? new ApiErrorHandler();
    (config.routeRegistrar ?? new RouteRegistrar(config.modules, config.uiEventPublisher)).register(this);
  }

  registerRoute(route: RegisteredRoute): void {
    this.routes.push(route);
  }

  async inject<T = unknown>(request: HttpRequest): Promise<HttpResponse<T>> {
    const matched = matchRoute(this.routes, request.method, request.path);

    if (!matched) {
      return {
        statusCode: 404,
        body: {
          error: `Route not found for ${request.method} ${request.path}.`,
        } as T,
      };
    }

    try {
      const context = this.requestContextFactory.create(request, matched.params);
      const body = await matched.route.handler(context);

      return {
        statusCode: 200,
        body: body as T,
      };
    } catch (error) {
      return this.errorHandler.toResponse(error) as HttpResponse<T>;
    }
  }

  async listen(options: HttpListenOptions): Promise<HttpListeningAddress> {
    if (this.nodeServer && this.listeningAddress) {
      return this.listeningAddress;
    }

    this.staticSite = options.staticSite;
    const server = createServer((request, response) => {
      void this.handleNodeRequest(request, response);
    });

    if (options.onServerCreated) {
      await options.onServerCreated(server);
    }

    await new Promise<void>((resolvePromise, rejectPromise) => {
      server.once('error', rejectPromise);
      server.listen(options.port, options.host, () => {
        server.off('error', rejectPromise);
        resolvePromise();
      });
    });

    const address = server.address();
    const resolvedPort = typeof address === 'object' && address ? address.port : options.port;
    this.nodeServer = server;
    this.listeningAddress = {
      host: options.host,
      port: resolvedPort,
      origin: `http://${options.host}:${resolvedPort}`,
    };
    return this.listeningAddress;
  }

  async close(): Promise<void> {
    if (!this.nodeServer) {
      return;
    }

    const server = this.nodeServer;
    this.nodeServer = undefined;
    this.listeningAddress = undefined;

    await new Promise<void>((resolvePromise, rejectPromise) => {
      server.close((error) => {
        if (error) {
          rejectPromise(error);
          return;
        }

        resolvePromise();
      });
    });
  }

  getListeningAddress(): HttpListeningAddress | null {
    return this.listeningAddress ?? null;
  }

  private async handleNodeRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const rawMethod = (request.method ?? 'GET').toUpperCase();
    const method = normaliseHttpMethod(rawMethod);
    const url = new URL(request.url ?? '/', 'http://lume-hub.local');

    if (method && url.pathname.startsWith('/api/')) {
      await this.handleApiRequest(request, response, method);
      return;
    }

    if (rawMethod === 'GET' || rawMethod === 'HEAD') {
      const served = await this.serveStaticAsset(url.pathname, response, rawMethod === 'HEAD');

      if (served) {
        return;
      }
    }

    response.writeHead(404, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify({ error: `Route not found for ${request.method ?? 'GET'} ${url.pathname}.` }));
  }

  private async handleApiRequest(
    request: IncomingMessage,
    response: ServerResponse,
    method: HttpMethod,
  ): Promise<void> {
    const bodyText = await readRequestBody(request);
    const requestPath = request.url ?? '/';

    try {
      const result = await this.inject({
        method,
        path: requestPath,
        body: parseRequestBody(bodyText, request.headers['content-type']),
        headers: mapHeaders(request.headers),
      });
      this.writeJsonResponse(response, result.statusCode, result.body);
    } catch (error) {
      const apiError = this.errorHandler.toResponse(error);
      this.writeJsonResponse(response, apiError.statusCode, apiError.body);
    }
  }

  private async serveStaticAsset(pathname: string, response: ServerResponse, headOnly: boolean): Promise<boolean> {
    if (!this.staticSite) {
      return false;
    }

    const filePath = resolveStaticFilePath(this.staticSite.rootPath, pathname);

    if (!filePath) {
      return false;
    }

    const exists = await fileExists(filePath);

    if (!exists) {
      if (pathname.includes('.')) {
        response.writeHead(404, {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
        });
        response.end(headOnly ? undefined : 'Not found.');
        return true;
      }

      const spaEntryPath = join(this.staticSite.rootPath, 'index.html');
      return this.serveFile(spaEntryPath, response, headOnly, true);
    }

    return this.serveFile(filePath, response, headOnly, filePath.endsWith('.html'));
  }

  private async serveFile(
    filePath: string,
    response: ServerResponse,
    headOnly: boolean,
    injectBootConfig: boolean,
  ): Promise<boolean> {
    if (!(await fileExists(filePath))) {
      return false;
    }

    const contentType = resolveContentType(filePath);
    let body = await readFile(filePath);

    if (injectBootConfig && this.staticSite?.bootConfig) {
      body = Buffer.from(injectFrontendBootConfig(body.toString('utf8'), this.staticSite.bootConfig), 'utf8');
    }

    response.writeHead(200, {
      'content-type': contentType,
      'cache-control': 'no-store',
    });

    if (!headOnly) {
      response.end(body);
      return true;
    }

    response.end();
    return true;
  }

  private writeJsonResponse(response: ServerResponse, statusCode: number, body: unknown): void {
    response.writeHead(statusCode, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify(body));
  }
}

export class RouteRegistrar {
  constructor(
    private readonly modules: HttpApiModules,
    private readonly uiEventPublisher?: UiEventPublisherLike,
  ) {}

  register(server: FastifyHttpServer): void {
    server.registerRoute({
      method: 'GET',
      path: '/api/dashboard',
      handler: async () => this.getDashboardSnapshot(),
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/status',
      handler: async () => this.getStatusSnapshot(),
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/runtime/diagnostics',
      handler: async () => {
        if (!this.modules.runtimeDiagnostics) {
          throw new ApiError(404, 'Runtime diagnostics are not configured.');
        }

        return this.modules.runtimeDiagnostics.getSnapshot();
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/migrations/readiness',
      handler: async () => {
        if (!this.modules.migrationReadiness) {
          throw new ApiError(404, 'Migration readiness is not configured.');
        }

        return this.modules.migrationReadiness.getSnapshot();
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/schedules',
      handler: async (context) => {
        if (!this.modules.weeklyPlanner) {
          throw new ApiError(404, 'Weekly planner is not configured.');
        }

        return this.modules.weeklyPlanner.getWeekSnapshot({
          weekId: readOptionalQueryString(context.query, 'weekId'),
          groupJid: readOptionalQueryString(context.query, 'groupJid'),
          timeZone: readOptionalQueryString(context.query, 'timeZone'),
        });
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/schedules',
      handler: async (context) => {
        if (!this.modules.weeklyPlanner) {
          throw new ApiError(404, 'Weekly planner is not configured.');
        }

        const schedule = await this.modules.weeklyPlanner.saveSchedule(readWeeklyPlannerUpsertBody(context.body));
        this.publish('schedules.updated', {
          eventId: schedule.eventId,
          groupJid: schedule.groupJid,
          weekId: schedule.weekId,
        });
        return schedule;
      },
    });
    server.registerRoute({
      method: 'PATCH',
      path: '/api/schedules/:eventId',
      handler: async (context) => {
        if (!this.modules.weeklyPlanner) {
          throw new ApiError(404, 'Weekly planner is not configured.');
        }

        const schedule = await this.modules.weeklyPlanner.saveSchedule({
          ...readWeeklyPlannerUpsertBody(context.body),
          eventId: context.params.eventId,
        });
        this.publish('schedules.updated', {
          eventId: schedule.eventId,
          groupJid: schedule.groupJid,
          weekId: schedule.weekId,
        });
        return schedule;
      },
    });
    server.registerRoute({
      method: 'DELETE',
      path: '/api/schedules/:eventId',
      handler: async (context) => {
        if (!this.modules.weeklyPlanner) {
          throw new ApiError(404, 'Weekly planner is not configured.');
        }

        const deleted = await this.modules.weeklyPlanner.deleteSchedule(context.params.eventId, {
          groupJid: readOptionalQueryString(context.query, 'groupJid'),
        });
        this.publish('schedules.deleted', {
          eventId: context.params.eventId,
          deleted,
        });
        return {
          deleted,
        };
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/migrations/wa-notify/schedules/files',
      handler: async () => {
        if (!this.modules.weeklyPlanner) {
          throw new ApiError(404, 'Weekly planner is not configured.');
        }

        return this.modules.weeklyPlanner.listLegacyScheduleFiles();
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/migrations/wa-notify/schedules/preview',
      handler: async (context) => {
        if (!this.modules.weeklyPlanner) {
          throw new ApiError(404, 'Weekly planner is not configured.');
        }

        return this.modules.weeklyPlanner.previewLegacyScheduleImport(readLegacyScheduleImportBody(context.body));
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/migrations/wa-notify/schedules/apply',
      handler: async (context) => {
        if (!this.modules.weeklyPlanner) {
          throw new ApiError(404, 'Weekly planner is not configured.');
        }

        const report = await this.modules.weeklyPlanner.applyLegacyScheduleImport(readLegacyScheduleImportBody(context.body));
        this.publish('schedules.import.completed', {
          fileName: report.sourceFile.fileName,
          created: report.totals.created,
          updated: report.totals.updated,
          unchanged: report.totals.unchanged,
          ambiguous: report.totals.ambiguous,
        });
        return report;
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/alerts/rules',
      handler: async () => {
        if (!this.modules.messageAlerts) {
          throw new ApiError(404, 'Message alerts are not configured.');
        }

        return this.modules.messageAlerts.listRules();
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/alerts/matches',
      handler: async (context) => {
        if (!this.modules.messageAlerts) {
          throw new ApiError(404, 'Message alerts are not configured.');
        }

        return this.modules.messageAlerts.listRecentMatches(readOptionalPositiveIntegerQuery(context.query, 'limit') ?? 20);
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/migrations/wa-notify/alerts/preview',
      handler: async () => {
        if (!this.modules.messageAlerts) {
          throw new ApiError(404, 'Message alerts are not configured.');
        }

        return this.modules.messageAlerts.previewLegacyImport();
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/migrations/wa-notify/alerts/apply',
      handler: async () => {
        if (!this.modules.messageAlerts) {
          throw new ApiError(404, 'Message alerts are not configured.');
        }

        const report = await this.modules.messageAlerts.applyLegacyImport();
        this.publish('alerts.import.completed', {
          importedRules: report.totals.importedRules,
        });
        return report;
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/automations/definitions',
      handler: async () => {
        if (!this.modules.automations) {
          throw new ApiError(404, 'Automations are not configured.');
        }

        return this.modules.automations.listDefinitions();
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/automations/runs',
      handler: async (context) => {
        if (!this.modules.automations) {
          throw new ApiError(404, 'Automations are not configured.');
        }

        return this.modules.automations.listRecentRuns(readOptionalPositiveIntegerQuery(context.query, 'limit') ?? 20);
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/migrations/wa-notify/automations/preview',
      handler: async () => {
        if (!this.modules.automations) {
          throw new ApiError(404, 'Automations are not configured.');
        }

        return this.modules.automations.previewLegacyImport();
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/migrations/wa-notify/automations/apply',
      handler: async () => {
        if (!this.modules.automations) {
          throw new ApiError(404, 'Automations are not configured.');
        }

        const report = await this.modules.automations.applyLegacyImport();
        this.publish('automations.import.completed', {
          importedDefinitions: report.totals.importedDefinitions,
          missingGroups: report.totals.missingGroups,
        });
        return report;
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/groups',
      handler: async () => this.modules.groupDirectory.listGroups(),
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/groups/:groupJid/intelligence',
      handler: async (context) => this.getGroupIntelligenceSnapshot(context.params.groupJid),
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/media/assets',
      handler: async () => {
        if (!this.modules.mediaLibrary) {
          throw new ApiError(404, 'Media library is not configured.');
        }

        return this.modules.mediaLibrary.listAssets();
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/media/assets/:assetId',
      handler: async (context) => {
        if (!this.modules.mediaLibrary) {
          throw new ApiError(404, 'Media library is not configured.');
        }

        const asset = await this.modules.mediaLibrary.getAsset(context.params.assetId);

        if (!asset) {
          throw new ApiError(404, `Media asset '${context.params.assetId}' was not found.`);
        }

        return asset;
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/workspace/files',
      handler: async (context) => {
        if (!this.modules.workspaceAgent) {
          throw new ApiError(404, 'Workspace agent is not configured.');
        }

        return this.modules.workspaceAgent.searchFiles(
          readOptionalQueryString(context.query, 'query'),
          readOptionalPositiveIntegerQuery(context.query, 'limit') ?? 80,
        );
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/workspace/file',
      handler: async (context) => {
        if (!this.modules.workspaceAgent) {
          throw new ApiError(404, 'Workspace agent is not configured.');
        }

        const relativePath = readRequiredQueryString(context.query, 'path');
        return this.modules.workspaceAgent.readFile(relativePath);
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/workspace/runs',
      handler: async (context) => {
        if (!this.modules.workspaceAgent) {
          throw new ApiError(404, 'Workspace agent is not configured.');
        }

        return this.modules.workspaceAgent.listRuns(readOptionalPositiveIntegerQuery(context.query, 'limit') ?? 12);
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/workspace/status',
      handler: async () => {
        if (!this.modules.workspaceAgent) {
          throw new ApiError(404, 'Workspace agent is not configured.');
        }

        return this.modules.workspaceAgent.getStatus();
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/workspace/agent/runs',
      handler: async (context) => {
        if (!this.modules.workspaceAgent) {
          throw new ApiError(404, 'Workspace agent is not configured.');
        }

        const run = await this.modules.workspaceAgent.run(readWorkspaceAgentRunBody(context.body));
        this.publish('workspace.agent.run.completed', {
          runId: run.runId,
          mode: run.mode,
          status: run.status,
          executionState: run.executionState,
          approvalState: run.approvalState,
          guardrailReason: run.guardrailReason,
          changedFiles: run.changedFiles,
        });
        return run;
      },
    });
    server.registerRoute({
      method: 'PUT',
      path: '/api/groups/:groupJid/llm-instructions',
      handler: async (context) => {
        const instructions = await this.modules.groupDirectory.updateGroupLlmInstructions(
          context.params.groupJid,
          readGroupInstructionsBody(context.body),
        );
        this.publish('groups.intelligence.instructions.updated', {
          groupJid: context.params.groupJid,
          source: instructions.source,
          resolvedFilePath: instructions.resolvedFilePath,
        });
        return instructions;
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/groups/:groupJid/knowledge/documents',
      handler: async (context) => {
        if (!this.modules.groupKnowledge) {
          throw new ApiError(404, 'Group knowledge is not configured.');
        }

        const document = await this.modules.groupKnowledge.upsertDocument(
          readGroupKnowledgeDocumentBody(context.body, context.params.groupJid),
        );
        this.publish('groups.knowledge.document.updated', {
          groupJid: context.params.groupJid,
          documentId: document.documentId,
          filePath: document.filePath,
        });
        return document;
      },
    });
    server.registerRoute({
      method: 'DELETE',
      path: '/api/groups/:groupJid/knowledge/documents/:documentId',
      handler: async (context) => {
        if (!this.modules.groupKnowledge) {
          throw new ApiError(404, 'Group knowledge is not configured.');
        }

        const result = await this.modules.groupKnowledge.deleteDocument(
          context.params.groupJid,
          context.params.documentId,
        );
        this.publish('groups.knowledge.document.deleted', result);
        return result;
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/groups/:groupJid/context-preview',
      handler: async (context) => this.getGroupContextPreview(context.params.groupJid, context.body),
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/people',
      handler: async () => {
        if (!this.modules.peopleMemory) {
          throw new ApiError(404, 'People memory is not configured.');
        }

        return this.modules.peopleMemory.listPeople();
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/people',
      handler: async (context) => {
        if (!this.modules.peopleMemory) {
          throw new ApiError(404, 'People memory is not configured.');
        }

        const person = await this.modules.peopleMemory.upsertByIdentifiers(readPersonUpsertBody(context.body));
        this.publish('people.updated', person);
        return person;
      },
    });
    server.registerRoute({
      method: 'PUT',
      path: '/api/people/:personId/roles',
      handler: async (context) => {
        if (!this.modules.peopleMemory) {
          throw new ApiError(404, 'People memory is not configured.');
        }

        const person = await this.modules.peopleMemory.updatePersonRoles(
          context.params.personId,
          readPersonRolesBody(context.body),
        );
        this.publish('people.roles.updated', person);
        return person;
      },
    });
    server.registerRoute({
      method: 'PUT',
      path: '/api/groups/:groupJid/owners',
      handler: async (context) => {
        const owners = readOwnersBody(context.body);
        const nextOwners = await this.modules.groupDirectory.replaceGroupOwners(context.params.groupJid, owners);
        this.publish('groups.owners.updated', {
          groupJid: context.params.groupJid,
          owners: nextOwners,
        });
        return nextOwners;
      },
    });
    server.registerRoute({
      method: 'PATCH',
      path: '/api/groups/:groupJid/calendar-access',
      handler: async (context) => {
        const update = readCalendarAccessBody(context.body);
        const nextPolicy = await this.modules.groupDirectory.updateCalendarAccessPolicy(context.params.groupJid, update);
        this.publish('groups.calendar_access.updated', {
          groupJid: context.params.groupJid,
          calendarAccessPolicy: nextPolicy,
        });
        return nextPolicy;
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/routing/rules',
      handler: async () => this.modules.audienceRouting.listSenderAudienceRules(),
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/routing/rules',
      handler: async (context) => {
        if (!context.body || typeof context.body !== 'object') {
          throw new ApiError(400, 'Routing rule payload must be an object.');
        }

        const rule = await this.modules.audienceRouting.upsertSenderAudienceRule(
          context.body as Parameters<HttpApiModules['audienceRouting']['upsertSenderAudienceRule']>[0],
        );
        this.publish('routing.rule.updated', rule);
        return rule;
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/routing/preview',
      handler: async (context) => {
        const input = readDistributionPreviewBody(context.body);
        return this.resolveDistributionPlan(input);
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/routing/distributions',
      handler: async () => (await this.modules.instructionQueue.listInstructions()).map((instruction) => mapInstruction(instruction)),
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/routing/distributions',
      handler: async (context) => {
        const input = readDistributionExecutionBody(context.body);
        const preview = await this.resolveDistributionPlan({
          sourceMessageId: input.sourceMessageId,
          personId: input.personId,
          identifiers: input.identifiers,
          messageText: input.content.kind === 'text' ? input.content.messageText : undefined,
          targetGroupJids: input.targetGroupJids,
        });
        const instruction = await this.modules.instructionQueue.enqueueDistributionPlan({
          plan: preview,
          content: input.content,
          mode: input.mode,
        });
        const summary = mapInstruction(instruction);
        this.publish('routing.distribution.created', summary);
        return {
          plan: preview,
          instruction: summary,
        };
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/instruction-queue',
      handler: async () => this.modules.instructionQueue.listInstructions(),
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/instruction-queue/:instructionId/retry',
      handler: async (context) => {
        const instruction = await this.modules.instructionQueue.retryInstruction(context.params.instructionId);
        this.publish('instruction.retry.accepted', {
          instructionId: instruction.instructionId,
          status: instruction.status,
        });
        return instruction;
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/whatsapp/workspace',
      handler: async () => this.getWhatsAppWorkspaceSnapshot(),
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/qr',
      handler: async () => {
        const runtimeSnapshot = await this.modules.whatsappRuntime?.getRuntimeSnapshot();
        return runtimeSnapshot?.qr ?? createEmptyWhatsAppRuntimeSnapshot().qr;
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/qr.svg',
      handler: async () => {
        const runtimeSnapshot = await this.modules.whatsappRuntime?.getRuntimeSnapshot();
        return {
          svg: runtimeSnapshot?.qr.svg ?? null,
        };
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/whatsapp/qr',
      handler: async () => {
        const runtimeSnapshot = await this.modules.whatsappRuntime?.getRuntimeSnapshot();
        return runtimeSnapshot?.qr ?? createEmptyWhatsAppRuntimeSnapshot().qr;
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/whatsapp/refresh',
      handler: async () => {
        await this.modules.whatsappRuntime?.refreshWorkspace();
        const snapshot = await this.getWhatsAppWorkspaceSnapshot();
        this.publish('whatsapp.workspace.refreshed', snapshot.runtime);
        return snapshot;
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/whatsapp/send-test',
      handler: async (context) => {
        if (!this.modules.whatsappRuntime) {
          throw new ApiError(404, 'WhatsApp runtime is not configured.');
        }

        if (!context.body || typeof context.body !== 'object') {
          throw new ApiError(400, 'WhatsApp test send payload must be an object.');
        }

        const chatJid = readStringBodyField(context.body, 'chatJid');
        const text = readStringBodyField(context.body, 'text');
        const sendResult = await this.modules.whatsappRuntime.sendText({
          chatJid,
          text,
          idempotencyKey: readOptionalStringBodyField(context.body, 'idempotencyKey'),
          messageId: readOptionalStringBodyField(context.body, 'messageId'),
        });
        this.publish('whatsapp.test_send.accepted', sendResult);
        return sendResult;
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/send',
      handler: async (context) => {
        if (!this.modules.whatsappRuntime) {
          throw new ApiError(404, 'WhatsApp runtime is not configured.');
        }

        const payload = readBodyObject(context.body, 'Send payload must be an object.');
        const sendResult = await this.modules.whatsappRuntime.sendText({
          chatJid: readRequiredStringValue(payload.chatJid, 'chatJid'),
          text: readRequiredStringValue(payload.text, 'text'),
          idempotencyKey: readOptionalTrimmedStringValue(payload.idempotencyKey, 'idempotencyKey'),
          messageId: readOptionalTrimmedStringValue(payload.messageId, 'messageId'),
        });
        this.publish('send.accepted', sendResult);
        return sendResult;
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/watchdog/issues',
      handler: async () => this.modules.watchdog.listIssues(),
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/watchdog/issues/:issueId/resolve',
      handler: async (context) => {
        const issue = await this.modules.watchdog.resolveIssue(context.params.issueId);
        this.publish('watchdog.issue.resolved', issue ?? { issueId: context.params.issueId });
        return issue;
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/settings',
      handler: async () => this.getSettingsSnapshot(),
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/llm/models',
      handler: async (context) => {
        if (!this.modules.llmOrchestrator) {
          throw new ApiError(404, 'LLM orchestrator is not configured.');
        }

        const refresh = readOptionalBooleanQuery(context.query, 'refresh');
        const providerId = readOptionalQueryString(context.query, 'providerId');

        if (refresh !== false) {
          await this.modules.llmOrchestrator.refreshModels(providerId ?? undefined);
        }

        return this.modules.llmOrchestrator.listModels();
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/llm/chat',
      handler: async (context) => {
        if (!this.modules.llmOrchestrator) {
          throw new ApiError(404, 'LLM orchestrator is not configured.');
        }

        const result = await this.modules.llmOrchestrator.chat(readLlmChatBody(context.body));
        this.publish('llm.chat.completed', {
          runId: result.runId,
          providerId: result.providerId,
          modelId: result.modelId,
        });
        return result;
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/assistant/schedules/preview',
      handler: async (context) => {
        if (!this.modules.agentRuntime) {
          throw new ApiError(404, 'Agent runtime is not configured.');
        }

        const payload = readAssistantScheduleBody(context.body, false);
        const operator = await this.resolveAssistantScheduleOperator(payload.groupJid, payload.personId);
        const preview = await this.modules.agentRuntime.previewScheduleApply({
          messageId: `assistant-schedule-preview-${randomUUID()}`,
          chatJid: payload.groupJid,
          chatType: 'group',
          groupJid: payload.groupJid,
          personId: operator.personId,
          senderDisplayName: payload.senderDisplayName ?? operator.displayName ?? 'Operador LumeHub',
          text: payload.text,
          allowActions: true,
          weekId: payload.weekId,
          requestedAccessMode: payload.requestedAccessMode,
        });
        this.publish('assistant.schedule.preview.generated', {
          groupJid: preview.groupJid,
          groupLabel: preview.groupLabel,
          operation: preview.operation,
          canApply: preview.canApply,
          previewFingerprint: preview.previewFingerprint,
        });
        return preview;
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/assistant/schedules/apply',
      handler: async (context) => {
        if (!this.modules.agentRuntime) {
          throw new ApiError(404, 'Agent runtime is not configured.');
        }

        const payload = readAssistantScheduleBody(context.body, true);
        const operator = await this.resolveAssistantScheduleOperator(payload.groupJid, payload.personId);
        const result = await this.modules.agentRuntime.applyScheduleAction({
          messageId: `assistant-schedule-apply-${randomUUID()}`,
          chatJid: payload.groupJid,
          chatType: 'group',
          groupJid: payload.groupJid,
          personId: operator.personId,
          senderDisplayName: payload.senderDisplayName ?? operator.displayName ?? 'Operador LumeHub',
          text: payload.text,
          allowActions: true,
          weekId: payload.weekId,
          requestedAccessMode: payload.requestedAccessMode,
          previewFingerprint: payload.previewFingerprint,
        });
        this.publish('assistant.schedule.apply.completed', {
          instructionId: result.instruction.instructionId,
          groupJid: result.preview.groupJid,
          groupLabel: result.preview.groupLabel,
          operation: result.preview.operation,
          appliedEventId: result.appliedEvent?.eventId ?? null,
        });
        return result;
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/logs/llm',
      handler: async (context) => {
        if (!this.modules.llmLogs) {
          throw new ApiError(404, 'LLM logs are not configured.');
        }

        return this.modules.llmLogs.readRecent(readOptionalPositiveIntegerQuery(context.query, 'limit') ?? 20);
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/logs/conversations',
      handler: async (context) => {
        if (!this.modules.conversationLogs) {
          throw new ApiError(404, 'Conversation logs are not configured.');
        }

        return this.modules.conversationLogs.readRecent(readOptionalPositiveIntegerQuery(context.query, 'limit') ?? 20);
      },
    });
    server.registerRoute({
      method: 'PATCH',
      path: '/api/settings/commands',
      handler: async (context) => {
        if (!this.modules.adminConfig.updateCommandsSettings) {
          throw new ApiError(404, 'Command settings are not configurable.');
        }

        const settings = await this.modules.adminConfig.updateCommandsSettings(readCommandsSettingsBody(context.body));
        this.publish('settings.commands.updated', settings.commands);
        return settings;
      },
    });
    server.registerRoute({
      method: 'PATCH',
      path: '/api/settings/llm',
      handler: async (context) => {
        if (!this.modules.adminConfig.updateLlmSettings) {
          throw new ApiError(404, 'LLM settings are not configurable.');
        }

        const settings = await this.modules.adminConfig.updateLlmSettings(readLlmSettingsBody(context.body));
        this.publish('settings.llm.updated', settings.llm);
        return settings;
      },
    });
    server.registerRoute({
      method: 'PATCH',
      path: '/api/settings/whatsapp',
      handler: async (context) => {
        if (!this.modules.adminConfig.updateWhatsAppSettings) {
          throw new ApiError(404, 'WhatsApp settings are not configurable.');
        }

        const settings = await this.modules.adminConfig.updateWhatsAppSettings(readWhatsAppSettingsBody(context.body));
        const runtimeSnapshot = await this.modules.whatsappRuntime?.applySettings(settings.whatsapp);
        this.publish('settings.whatsapp.updated', settings.whatsapp);
        if (runtimeSnapshot) {
          this.publish('whatsapp.runtime.updated', runtimeSnapshot);
        }
        return settings;
      },
    });
    server.registerRoute({
      method: 'PATCH',
      path: '/api/settings/ui',
      handler: async (context) => {
        if (!context.body || typeof context.body !== 'object') {
          throw new ApiError(400, 'UI settings payload must be an object.');
        }

        const defaultNotificationRules = (context.body as { defaultNotificationRules?: unknown }).defaultNotificationRules;

        if (!Array.isArray(defaultNotificationRules)) {
          throw new ApiError(400, 'defaultNotificationRules must be an array.');
        }

        const settings = await this.modules.adminConfig.updateUiSettings({
          defaultNotificationRules,
        });
        this.publish('settings.ui.updated', settings.ui);
        return settings;
      },
    });
    server.registerRoute({
      method: 'PATCH',
      path: '/api/settings/power-policy',
      handler: async (context) => {
        if (!context.body || typeof context.body !== 'object') {
          throw new ApiError(400, 'Power policy payload must be an object.');
        }

        const status = await this.modules.systemPower.updatePowerPolicy(
          context.body as Parameters<HttpApiModules['systemPower']['updatePowerPolicy']>[0],
        );
        const powerStatus = await this.modules.systemPower.getPowerStatus();
        this.publish('settings.power.updated', powerStatus);
        return powerStatus;
      },
    });
    server.registerRoute({
      method: 'PATCH',
      path: '/api/settings/autostart',
      handler: async (context) => {
        const enabled = readBooleanBodyField(context.body, 'enabled');

        if (enabled) {
          await this.modules.hostLifecycle.enableStartWithSystem();
        } else {
          await this.modules.hostLifecycle.disableStartWithSystem();
        }

        const status = await this.modules.hostLifecycle.getHostCompanionStatus();
        this.publish('settings.autostart.updated', status.autostart);
        return status;
      },
    });
    server.registerRoute({
      method: 'GET',
      path: '/api/settings/codex-auth-router',
      handler: async () => {
        if (!this.modules.codexAuthRouter) {
          return null;
        }

        return this.modules.codexAuthRouter.getStatus();
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/settings/codex-auth-router/prepare',
      handler: async () => {
        if (!this.modules.codexAuthRouter) {
          throw new ApiError(404, 'Codex auth router is not configured.');
        }

        const selection = await this.modules.codexAuthRouter.prepareAuthForRequest({
          reason: 'backend_manual_prepare',
        });
        const status = await this.modules.codexAuthRouter.getStatus();
        this.publish('settings.codex_auth_router.updated', {
          selection,
          status,
        });
        return status;
      },
    });
    server.registerRoute({
      method: 'POST',
      path: '/api/settings/codex-auth-router/switch',
      handler: async (context) => {
        if (!this.modules.codexAuthRouter) {
          throw new ApiError(404, 'Codex auth router is not configured.');
        }

        if (!context.body || typeof context.body !== 'object') {
          throw new ApiError(400, 'Codex auth router switch payload must be an object.');
        }

        const accountId = readStringBodyField(context.body, 'accountId');
        const selection = await this.modules.codexAuthRouter.forceSwitch(accountId, {
          reason: 'backend_manual_switch',
        });
        const status = await this.modules.codexAuthRouter.getStatus();
        this.publish('settings.codex_auth_router.updated', {
          selection,
          status,
        });
        return status;
      },
    });
  }

  private async getDashboardSnapshot() {
    const [health, readiness, groups, rules, instructions, issues, hostStatus, whatsAppRuntime] = await Promise.all([
      this.modules.healthMonitor.getHealthSnapshot(),
      this.modules.healthMonitor.getReadiness(),
      this.modules.groupDirectory.listGroups(),
      this.modules.audienceRouting.listSenderAudienceRules(),
      this.modules.instructionQueue.listInstructions(),
      this.modules.watchdog.listIssues({
        status: 'open',
      }),
      this.modules.hostLifecycle.getHostCompanionStatus(),
      this.modules.whatsappRuntime?.getRuntimeSnapshot() ?? Promise.resolve(createEmptyWhatsAppRuntimeSnapshot()),
    ]);

    return {
      health,
      readiness,
      groups: {
        total: groups.length,
        withOwners: groups.filter((group) => group.groupOwners.length > 0).length,
        readWriteGroupOwnerAccess: groups.filter((group) => group.calendarAccessPolicy.groupOwner === 'read_write').length,
      },
      routing: {
        totalRules: rules.length,
        confirmationRules: rules.filter((rule) => rule.requiresConfirmation).length,
        totalPlannedTargets: rules.reduce(
          (sum, rule) => sum + rule.targetGroupJids.length + rule.targetCourseIds.length + rule.targetDisciplineCodes.length,
          0,
        ),
      },
      distributions: {
        total: instructions.length,
        queued: instructions.filter((instruction) => instruction.status === 'queued').length,
        running: instructions.filter((instruction) => instruction.status === 'running').length,
        completed: instructions.filter((instruction) => instruction.status === 'completed').length,
        partialFailed: instructions.filter((instruction) => instruction.status === 'partial_failed').length,
        failed: instructions.filter((instruction) => instruction.status === 'failed').length,
      },
      watchdog: {
        openIssues: issues.length,
        recentIssues: issues.slice(0, 5).map((issue) => ({
          issueId: issue.issueId,
          kind: issue.kind,
          groupLabel: issue.groupLabel,
          summary: issue.summary,
          openedAt: issue.openedAt,
        })),
      },
      hostCompanion: {
        hostId: hostStatus.hostId,
        authExists: hostStatus.auth.exists,
        sameAsCodexCanonical: hostStatus.auth.sameAsCodexCanonical,
        autostartEnabled: hostStatus.autostart.enabled,
        lastHeartbeatAt: hostStatus.runtime.lastHeartbeatAt,
        lastError: hostStatus.runtime.lastError,
      },
      whatsapp: {
        phase: whatsAppRuntime.session.phase,
        connected: whatsAppRuntime.session.connected,
        loginRequired: whatsAppRuntime.session.loginRequired,
        discoveredGroups: whatsAppRuntime.groups.length,
        discoveredConversations: whatsAppRuntime.conversations.length,
      },
    };
  }

  private async getStatusSnapshot() {
    const dashboard = await this.getDashboardSnapshot();

    return {
      readiness: dashboard.readiness,
      health: dashboard.health,
      groups: dashboard.groups,
      routing: dashboard.routing,
      distributions: dashboard.distributions,
      watchdog: dashboard.watchdog,
      hostCompanion: dashboard.hostCompanion,
      whatsapp: dashboard.whatsapp,
      generatedAt: new Date().toISOString(),
    };
  }

  private async getSettingsSnapshot() {
    const [adminSettings, powerStatus, hostStatus, authRouterStatus] = await Promise.all([
      this.modules.adminConfig.getSettings(),
      this.modules.systemPower.getPowerStatus(),
      this.modules.hostLifecycle.getHostCompanionStatus(),
      this.modules.codexAuthRouter?.getStatus() ?? Promise.resolve(null),
    ]);
    const llmRuntime =
      (await this.modules.llmRuntime?.getStatus()) ??
      (await this.modules.adminConfig.getLlmRuntimeStatus({
        codexAuthReady: readCodexAuthReady(authRouterStatus),
        openAiCompatReady: readOpenAiCompatReadyFromEnv(),
      }));

    return {
      adminSettings: normaliseAdminSettings(adminSettings),
      llmRuntime,
      powerStatus,
      hostStatus,
      authRouterStatus,
    };
  }

  private async resolveAssistantScheduleOperator(
    groupJid: string,
    explicitPersonId?: string,
  ): Promise<{ readonly personId: string | null; readonly displayName: string | null }> {
    if (!this.modules.peopleMemory) {
      return {
        personId: explicitPersonId ?? null,
        displayName: null,
      };
    }

    const people = await this.modules.peopleMemory.listPeople();

    if (explicitPersonId) {
      const explicit = people.find((person) => person.personId === explicitPersonId);
      return {
        personId: explicit?.personId ?? explicitPersonId,
        displayName: explicit?.displayName ?? null,
      };
    }

    const appOwner = people.find((person) => person.globalRoles.includes('app_owner'));

    if (appOwner) {
      return {
        personId: appOwner.personId,
        displayName: appOwner.displayName,
      };
    }

    const groups = await this.modules.groupDirectory.listGroups();
    const groupOwnerId = groups.find((group) => group.groupJid === groupJid)?.groupOwners[0]?.personId ?? null;
    const groupOwner = groupOwnerId ? people.find((person) => person.personId === groupOwnerId) : null;

    return {
      personId: groupOwnerId,
      displayName: groupOwner?.displayName ?? null,
    };
  }

  private async getGroupIntelligenceSnapshot(groupJid: string) {
    if (!this.modules.groupKnowledge) {
      throw new ApiError(404, 'Group knowledge is not configured.');
    }

    const [instructions, knowledge] = await Promise.all([
      this.modules.groupDirectory.getGroupLlmInstructions(groupJid),
      this.modules.groupKnowledge.getIndex(groupJid),
    ]);

    return {
      groupJid,
      instructions,
      knowledge: {
        indexFilePath: knowledge.indexFilePath,
        exists: knowledge.exists,
        documents: knowledge.documents,
      },
    };
  }

  private async getGroupContextPreview(groupJid: string, body: unknown) {
    if (!this.modules.assistantContext) {
      throw new ApiError(404, 'Assistant context is not configured.');
    }

    const payload = readGroupContextPreviewBody(body, groupJid);
    const preview = await this.modules.assistantContext.buildChatContext(payload);

    return {
      chatJid: preview.chatJid,
      chatType: preview.chatType,
      currentText: preview.currentText,
      personId: preview.personId,
      senderDisplayName: preview.senderDisplayName,
      groupJid: preview.groupJid,
      group: preview.group,
      groupInstructions: preview.groupInstructions,
      groupInstructionsSource: preview.groupInstructionsSource,
      groupKnowledgeSnippets: preview.groupKnowledgeSnippets,
      groupPolicy: preview.groupPolicy,
      generatedAt: preview.generatedAt,
    };
  }

  private async getWhatsAppWorkspaceSnapshot() {
    const [adminSettingsInput, groups, people, hostStatus, authRouterStatus, runtime] = await Promise.all([
      this.modules.adminConfig.getSettings(),
      this.modules.groupDirectory.listGroups(),
      this.modules.peopleMemory?.listPeople() ?? Promise.resolve([]),
      this.modules.hostLifecycle.getHostCompanionStatus(),
      this.modules.codexAuthRouter?.getStatus() ?? Promise.resolve(null),
      this.modules.whatsappRuntime?.getRuntimeSnapshot() ?? Promise.resolve(createEmptyWhatsAppRuntimeSnapshot()),
    ]);
    const adminSettings = normaliseAdminSettings(adminSettingsInput);
    const peopleById = new Map(people.map((person) => [person.personId, person]));
    const ownedGroupsByPersonId = new Map<string, string[]>();
    const runtimeGroupsByJid = new Map(runtime.groups.map((group) => [group.groupJid, group]));
    const runtimeConversationsByJid = new Map(runtime.conversations.map((conversation) => [conversation.chatJid, conversation]));

    for (const group of groups) {
      for (const owner of group.groupOwners) {
        const ownedGroups = ownedGroupsByPersonId.get(owner.personId) ?? [];
        ownedGroups.push(group.groupJid);
        ownedGroupsByPersonId.set(owner.personId, ownedGroups);
      }
    }

    const allowAllGroups = adminSettings.commands.authorizedGroupJids.length === 0;
    const allowAllPrivateChats = adminSettings.commands.authorizedPrivateJids.length === 0;
    const knownGroupJids = new Set(groups.map((group) => group.groupJid));
    const knownPrivateJids = new Set<string>();
    const groupSummaries = groups.map((group) => {
      const runtimeGroup = runtimeGroupsByJid.get(group.groupJid);

      return {
        groupJid: group.groupJid,
        preferredSubject: runtimeGroup?.subject ?? group.preferredSubject,
        aliases: dedupeStringArray([...(runtimeGroup?.aliases ?? []), ...group.aliases]),
        courseId: group.courseId,
        ownerPersonIds: group.groupOwners.map((owner) => owner.personId),
        ownerLabels: group.groupOwners.map((owner) => peopleById.get(owner.personId)?.displayName ?? owner.personId),
        assistantAuthorized:
          adminSettings.commands.assistantEnabled &&
          adminSettings.whatsapp.enabled &&
          (allowAllGroups || adminSettings.commands.authorizedGroupJids.includes(group.groupJid)),
        calendarAccessPolicy: group.calendarAccessPolicy,
        lastRefreshedAt: runtimeGroup?.updatedAt ?? group.lastRefreshedAt,
        knownToBot: runtimeGroupsByJid.has(group.groupJid),
      };
    });

    for (const runtimeGroup of runtime.groups) {
      if (knownGroupJids.has(runtimeGroup.groupJid)) {
        continue;
      }

      groupSummaries.push({
        groupJid: runtimeGroup.groupJid,
        preferredSubject: runtimeGroup.subject,
        aliases: runtimeGroup.aliases,
        courseId: null,
        ownerPersonIds: [],
        ownerLabels: [],
        assistantAuthorized:
          adminSettings.commands.assistantEnabled &&
          adminSettings.whatsapp.enabled &&
          (allowAllGroups || adminSettings.commands.authorizedGroupJids.includes(runtimeGroup.groupJid)),
        calendarAccessPolicy: DEFAULT_GROUP_CALENDAR_ACCESS_POLICY,
        lastRefreshedAt: runtimeGroup.updatedAt,
        knownToBot: true,
      });
      knownGroupJids.add(runtimeGroup.groupJid);
    }

    for (const groupJid of adminSettings.commands.authorizedGroupJids) {
      if (knownGroupJids.has(groupJid)) {
        continue;
      }

      groupSummaries.push({
        groupJid,
        preferredSubject: groupJid,
        aliases: [],
        courseId: null,
        ownerPersonIds: [],
        ownerLabels: [],
        assistantAuthorized: adminSettings.commands.assistantEnabled && adminSettings.whatsapp.enabled,
        calendarAccessPolicy: DEFAULT_GROUP_CALENDAR_ACCESS_POLICY,
        lastRefreshedAt: null,
        knownToBot: false,
      });
    }

    const appOwners = people
      .filter((person) => person.globalRoles.includes('app_owner'))
      .map((person) =>
        mapConversationSummary(
          person,
          ownedGroupsByPersonId,
          adminSettings.commands,
          adminSettings.whatsapp.enabled,
          allowAllPrivateChats,
          runtimeConversationsByJid,
        ),
      );

    const conversations = people
      .filter((person) => person.identifiers.some((identifier) => identifier.kind === 'whatsapp_jid'))
      .map((person) => {
        const summary = mapConversationSummary(
          person,
          ownedGroupsByPersonId,
          adminSettings.commands,
          adminSettings.whatsapp.enabled,
          allowAllPrivateChats,
          runtimeConversationsByJid,
        );

        for (const whatsappJid of summary.whatsappJids) {
          knownPrivateJids.add(whatsappJid);
        }

        return summary;
      });

    for (const runtimeConversation of runtime.conversations) {
      if (knownPrivateJids.has(runtimeConversation.chatJid)) {
        continue;
      }

      conversations.push({
        personId: null,
        displayName: runtimeConversation.displayName,
        whatsappJids: [runtimeConversation.chatJid],
        globalRoles: ['member'],
        privateAssistantAuthorized:
          adminSettings.commands.assistantEnabled &&
          adminSettings.whatsapp.enabled &&
          adminSettings.commands.allowPrivateAssistant &&
          (allowAllPrivateChats ||
            adminSettings.commands.authorizedPrivateJids.includes(runtimeConversation.chatJid)),
        ownedGroupJids: [],
        knownToBot: true,
      });
      knownPrivateJids.add(runtimeConversation.chatJid);
    }

    for (const chatJid of adminSettings.commands.authorizedPrivateJids) {
      if (knownPrivateJids.has(chatJid)) {
        continue;
      }

      conversations.push({
        personId: null,
        displayName: chatJid,
        whatsappJids: [chatJid],
        globalRoles: ['member'],
        privateAssistantAuthorized:
          adminSettings.commands.assistantEnabled && adminSettings.commands.allowPrivateAssistant,
        ownedGroupJids: [],
        knownToBot: false,
      });
    }

    groupSummaries.sort(compareByLabel);
    conversations.sort(compareByLabel);
    appOwners.sort(compareByLabel);

    return {
      settings: {
        commands: adminSettings.commands,
        whatsapp: adminSettings.whatsapp,
      },
      runtime: {
        session: runtime.session,
        qr: runtime.qr,
        discoveredGroups: runtime.groups.length,
        discoveredConversations: runtime.conversations.length,
        lastDiscoveryAt: latestDiscoveryAt(runtime),
      },
      host: {
        authFilePath: hostStatus.auth.filePath,
        canonicalAuthFilePath: authRouterStatus?.canonicalAuthFilePath ?? hostStatus.auth.filePath,
        authExists: hostStatus.auth.exists,
        sameAsCodexCanonical: hostStatus.auth.sameAsCodexCanonical,
        autostartEnabled: hostStatus.autostart.enabled,
        lastHeartbeatAt: hostStatus.runtime.lastHeartbeatAt,
      },
      groups: groupSummaries,
      conversations,
      appOwners,
      permissionSummary: {
        knownGroups: groupSummaries.filter((group) => group.knownToBot).length,
        authorizedGroups: groupSummaries.filter((group) => group.assistantAuthorized).length,
        knownPrivateConversations: conversations.filter((conversation) => conversation.knownToBot).length,
        authorizedPrivateConversations: conversations.filter((conversation) => conversation.privateAssistantAuthorized).length,
        appOwners: appOwners.length,
      },
    };
  }

  private async resolveDistributionPlan(input: {
    readonly sourceMessageId: string;
    readonly personId?: string;
    readonly identifiers?: readonly { readonly kind: string; readonly value: string }[];
    readonly messageText?: string;
    readonly targetGroupJids?: readonly string[];
  }) {
    const targetGroupJids = dedupeStringArray(input.targetGroupJids ?? []);

    if (targetGroupJids.length > 0) {
      return this.buildManualDistributionPlan(input.sourceMessageId, targetGroupJids, input.personId);
    }

    return this.modules.audienceRouting.previewDistributionPlan(input.sourceMessageId, {
      personId: input.personId ?? undefined,
      identifiers: input.identifiers,
      messageText: input.messageText,
    });
  }

  private async buildManualDistributionPlan(
    sourceMessageId: string,
    targetGroupJids: readonly string[],
    personId?: string,
  ) {
    const groups = await this.modules.groupDirectory.listGroups();
    const groupsByJid = new Map(groups.map((group) => [group.groupJid, group]));
    const missingGroupJids = targetGroupJids.filter((groupJid) => !groupsByJid.has(groupJid));

    if (missingGroupJids.length > 0) {
      throw new ApiError(400, `Unknown targetGroupJids: ${missingGroupJids.join(', ')}.`);
    }

    let senderDisplayName: string | null = null;

    if (personId && this.modules.peopleMemory) {
      const people = await this.modules.peopleMemory.listPeople();
      senderDisplayName = people.find((person) => person.personId === personId)?.displayName ?? null;
    }

    return {
      sourceMessageId,
      senderPersonId: personId ?? null,
      senderDisplayName,
      matchedRuleIds: [],
      matchedDisciplineCodes: [],
      requiresConfirmation: false,
      targetCount: targetGroupJids.length,
      targets: targetGroupJids.map((groupJid) => {
        const group = groupsByJid.get(groupJid);

        return {
          groupJid,
          preferredSubject: group?.preferredSubject ?? groupJid,
          courseId: group?.courseId ?? null,
          reasons: ['manual_group_selection'],
          dedupeKey: `${sourceMessageId}:${groupJid}`,
        };
      }),
    };
  }

  private publish(topic: string, payload: unknown): void {
    this.uiEventPublisher?.publish(topic, payload);
  }
}

function normaliseAdminSettings(input: Partial<AdminSettings>): AdminSettings {
  return {
    schemaVersion: 1,
    commands: normaliseCommandsSettings(input.commands),
    whatsapp: normaliseWhatsAppSettings(input.whatsapp),
    llm: {
      ...DEFAULT_ADMIN_SETTINGS.llm,
      ...(input.llm ?? {}),
    },
    ui: {
      ...DEFAULT_ADMIN_SETTINGS.ui,
      ...(input.ui ?? {}),
      defaultNotificationRules: Array.isArray(input.ui?.defaultNotificationRules)
        ? input.ui.defaultNotificationRules
        : DEFAULT_ADMIN_SETTINGS.ui.defaultNotificationRules,
    },
    alerts: {
      ...DEFAULT_ADMIN_SETTINGS.alerts,
      ...(input.alerts ?? {}),
      rules: Array.isArray(input.alerts?.rules) ? input.alerts.rules : DEFAULT_ADMIN_SETTINGS.alerts.rules,
    },
    automations: {
      ...DEFAULT_ADMIN_SETTINGS.automations,
      ...(input.automations ?? {}),
      definitions: Array.isArray(input.automations?.definitions)
        ? input.automations.definitions
        : DEFAULT_ADMIN_SETTINGS.automations.definitions,
    },
    updatedAt: input.updatedAt ?? DEFAULT_ADMIN_SETTINGS.updatedAt,
  };
}

function normaliseCommandsSettings(input: Partial<CommandsPolicySettings> | undefined): CommandsPolicySettings {
  const legacy = (input ?? {}) as Partial<CommandsPolicySettings> & {
    readonly autoReplyInGroup?: boolean;
  };

  return {
    assistantEnabled: legacy.assistantEnabled ?? DEFAULT_ADMIN_SETTINGS.commands.assistantEnabled,
    schedulingEnabled: legacy.schedulingEnabled ?? DEFAULT_ADMIN_SETTINGS.commands.schedulingEnabled,
    ownerTerminalEnabled: legacy.ownerTerminalEnabled ?? DEFAULT_ADMIN_SETTINGS.commands.ownerTerminalEnabled,
    autoReplyEnabled:
      legacy.autoReplyEnabled ?? legacy.autoReplyInGroup ?? DEFAULT_ADMIN_SETTINGS.commands.autoReplyEnabled,
    directRepliesEnabled: legacy.directRepliesEnabled ?? DEFAULT_ADMIN_SETTINGS.commands.directRepliesEnabled,
    allowPrivateAssistant: legacy.allowPrivateAssistant ?? DEFAULT_ADMIN_SETTINGS.commands.allowPrivateAssistant,
    authorizedGroupJids: normaliseStringArray(
      legacy.authorizedGroupJids ?? DEFAULT_ADMIN_SETTINGS.commands.authorizedGroupJids,
    ),
    authorizedPrivateJids: normaliseStringArray(
      legacy.authorizedPrivateJids ?? DEFAULT_ADMIN_SETTINGS.commands.authorizedPrivateJids,
    ),
  };
}

function normaliseWhatsAppSettings(input: Partial<WhatsAppSettings> | undefined): WhatsAppSettings {
  return {
    enabled: input?.enabled ?? DEFAULT_ADMIN_SETTINGS.whatsapp.enabled,
    sharedAuthWithCodex: input?.sharedAuthWithCodex ?? DEFAULT_ADMIN_SETTINGS.whatsapp.sharedAuthWithCodex,
    groupDiscoveryEnabled: input?.groupDiscoveryEnabled ?? DEFAULT_ADMIN_SETTINGS.whatsapp.groupDiscoveryEnabled,
    conversationDiscoveryEnabled:
      input?.conversationDiscoveryEnabled ?? DEFAULT_ADMIN_SETTINGS.whatsapp.conversationDiscoveryEnabled,
  };
}

function mapConversationSummary(
  person: Person,
  ownedGroupsByPersonId: ReadonlyMap<string, readonly string[]>,
  commands: CommandsPolicySettings,
  whatsappEnabled: boolean,
  allowAllPrivateChats: boolean,
  runtimeConversationsByJid: ReadonlyMap<string, { readonly chatJid: string }>,
): {
  readonly personId: string | null;
  readonly displayName: string;
  readonly whatsappJids: readonly string[];
  readonly globalRoles: readonly PersonRole[];
  readonly privateAssistantAuthorized: boolean;
  readonly ownedGroupJids: readonly string[];
  readonly knownToBot: boolean;
} {
  const whatsappJids = person.identifiers
    .filter((identifier) => identifier.kind === 'whatsapp_jid')
    .map((identifier) => identifier.value);

  return {
    personId: person.personId,
    displayName: person.displayName,
    whatsappJids,
    globalRoles: person.globalRoles,
    privateAssistantAuthorized:
      commands.assistantEnabled &&
      whatsappEnabled &&
      commands.allowPrivateAssistant &&
      whatsappJids.length > 0 &&
      (allowAllPrivateChats || whatsappJids.some((chatJid) => commands.authorizedPrivateJids.includes(chatJid))),
    ownedGroupJids: ownedGroupsByPersonId.get(person.personId) ?? [],
    knownToBot: whatsappJids.some((chatJid) => runtimeConversationsByJid.has(chatJid)),
  };
}

function createEmptyWhatsAppRuntimeSnapshot(): WhatsAppRuntimeSnapshot {
  return {
    flags: {
      enabled: DEFAULT_ADMIN_SETTINGS.whatsapp.enabled,
      groupDiscoveryEnabled: DEFAULT_ADMIN_SETTINGS.whatsapp.groupDiscoveryEnabled,
      conversationDiscoveryEnabled: DEFAULT_ADMIN_SETTINGS.whatsapp.conversationDiscoveryEnabled,
    },
    session: {
      phase: 'idle',
      connected: false,
      loginRequired: true,
      sessionPresent: false,
      lastQrAt: null,
      lastConnectedAt: null,
      lastDisconnectAt: null,
      lastDisconnectReason: null,
      lastError: null,
      selfJid: null,
      pushName: null,
    },
    qr: {
      available: false,
      value: null,
      svg: null,
      updatedAt: null,
      expiresAt: null,
    },
    groups: [],
    conversations: [],
  };
}

function latestDiscoveryAt(runtime: WhatsAppRuntimeSnapshot): string | null {
  const timestamps = [
    ...runtime.groups.map((group) => group.updatedAt),
    ...runtime.conversations.map((conversation) => conversation.updatedAt),
  ].filter((value) => value.length > 0);

  if (timestamps.length === 0) {
    return null;
  }

  return timestamps.sort().at(-1) ?? null;
}

function dedupeStringArray(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function compareByLabel(
  left: { readonly displayName?: string; readonly preferredSubject?: string },
  right: { readonly displayName?: string; readonly preferredSubject?: string },
): number {
  const leftLabel = left.displayName ?? left.preferredSubject ?? '';
  const rightLabel = right.displayName ?? right.preferredSubject ?? '';
  return leftLabel.localeCompare(rightLabel, 'pt-PT');
}

function matchRoute(
  routes: readonly RegisteredRoute[],
  method: HttpMethod,
  rawPath: string,
): { readonly route: RegisteredRoute; readonly params: Record<string, string> } | null {
  const pathname = new URL(rawPath, 'http://lume-hub.local').pathname;
  const pathSegments = splitPath(pathname);

  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }

    const routeSegments = splitPath(route.path);

    if (routeSegments.length !== pathSegments.length) {
      continue;
    }

    const params: Record<string, string> = {};
    let matches = true;

    for (let index = 0; index < routeSegments.length; index += 1) {
      const routeSegment = routeSegments[index];
      const pathSegment = pathSegments[index];

      if (routeSegment.startsWith(':')) {
        params[routeSegment.slice(1)] = decodeURIComponent(pathSegment);
        continue;
      }

      if (routeSegment !== pathSegment) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return {
        route,
        params,
      };
    }
  }

  return null;
}

function splitPath(pathname: string): readonly string[] {
  return pathname.split('/').filter(Boolean);
}

function parseQuery(searchParams: URLSearchParams): Record<string, string | readonly string[]> {
  const query: Record<string, string | readonly string[]> = {};

  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    query[key] = values.length <= 1 ? values[0] ?? '' : values;
  }

  return query;
}

function readOwnersBody(body: unknown): readonly { readonly personId: string; readonly assignedAt?: string; readonly assignedBy?: string | null }[] {
  if (!body || typeof body !== 'object' || !('owners' in body)) {
    throw new ApiError(400, 'owners payload is required.');
  }

  const owners = (body as { owners?: unknown }).owners;

  if (!Array.isArray(owners)) {
    throw new ApiError(400, 'owners must be an array.');
  }

  return owners.map((owner) => {
    if (!owner || typeof owner !== 'object' || typeof (owner as { personId?: unknown }).personId !== 'string') {
      throw new ApiError(400, 'each owner must include personId.');
    }

    return {
      personId: (owner as { personId: string }).personId,
      assignedAt: typeof (owner as { assignedAt?: unknown }).assignedAt === 'string'
        ? (owner as { assignedAt?: string }).assignedAt
        : undefined,
      assignedBy:
        typeof (owner as { assignedBy?: unknown }).assignedBy === 'string' || (owner as { assignedBy?: unknown }).assignedBy === null
          ? ((owner as { assignedBy?: string | null }).assignedBy ?? null)
          : undefined,
    };
  });
}

function readPersonUpsertBody(body: unknown): PersonUpsertInput {
  const payload = readBodyObject(body, 'Person payload must be an object.');
  const displayName = readRequiredStringValue(payload.displayName, 'displayName');

  if (!Array.isArray(payload.identifiers)) {
    throw new ApiError(400, 'identifiers must be an array.');
  }

  const identifiers = payload.identifiers.map((identifier) => {
    if (!identifier || typeof identifier !== 'object') {
      throw new ApiError(400, 'each identifier must be an object.');
    }

    return {
      kind: readRequiredStringValue((identifier as Record<string, unknown>).kind, 'identifier.kind'),
      value: readRequiredStringValue((identifier as Record<string, unknown>).value, 'identifier.value'),
    };
  });

  return {
    personId:
      typeof payload.personId === 'string' && payload.personId.trim().length > 0 ? payload.personId.trim() : undefined,
    displayName,
    identifiers,
    globalRoles: payload.globalRoles === undefined ? undefined : readRolesArray(payload.globalRoles),
  };
}

function readPersonRolesBody(body: unknown): readonly PersonRole[] {
  const payload = readBodyObject(body, 'Person roles payload must be an object.');
  return readRolesArray(payload.globalRoles);
}

function readCalendarAccessBody(body: unknown): Partial<GroupCalendarAccessPolicy> {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'calendar access payload must be an object.');
  }

  const update = body as Partial<GroupCalendarAccessPolicy>;

  for (const key of ['group', 'groupOwner', 'appOwner'] as const) {
    if (update[key] !== undefined && update[key] !== 'read' && update[key] !== 'read_write') {
      throw new ApiError(400, `${key} must be 'read' or 'read_write'.`);
    }
  }

  return update;
}

function readGroupInstructionsBody(body: unknown): { readonly content: string } {
  const payload = readBodyObject(body, 'Group instructions payload must be an object.');

  return {
    content: readRequiredStringValue(payload.content, 'content'),
  };
}

function readGroupKnowledgeDocumentBody(
  body: unknown,
  groupJid: string,
): {
  readonly groupJid: string;
  readonly documentId: string;
  readonly filePath: string;
  readonly title: string;
  readonly summary?: string | null;
  readonly aliases?: readonly string[];
  readonly tags?: readonly string[];
  readonly enabled?: boolean;
  readonly content: string;
} {
  const payload = readBodyObject(body, 'Group knowledge document payload must be an object.');

  return {
    groupJid,
    documentId: readRequiredStringValue(payload.documentId, 'documentId'),
    filePath: readRequiredStringValue(payload.filePath, 'filePath'),
    title: readRequiredStringValue(payload.title, 'title'),
    summary:
      payload.summary === null
        ? null
        : readOptionalTrimmedStringValue(payload.summary, 'summary'),
    aliases: readOptionalStringArrayValue(payload.aliases, 'aliases'),
    tags: readOptionalStringArrayValue(payload.tags, 'tags'),
    enabled: readOptionalBooleanValue(payload.enabled, 'enabled'),
    content: readRequiredStringValue(payload.content, 'content'),
  };
}

function readGroupContextPreviewBody(
  body: unknown,
  groupJid: string,
): {
  readonly chatJid: string;
  readonly chatType: 'group';
  readonly groupJid: string;
  readonly text: string;
  readonly personId?: string | null;
  readonly senderDisplayName?: string | null;
} {
  const payload = readBodyObject(body, 'Group context preview payload must be an object.');

  return {
    chatJid: groupJid,
    chatType: 'group',
    groupJid,
    text: readRequiredStringValue(payload.text, 'text'),
    personId: readOptionalTrimmedStringValue(payload.personId, 'personId') ?? null,
    senderDisplayName: readOptionalTrimmedStringValue(payload.senderDisplayName, 'senderDisplayName') ?? null,
  };
}

function readCommandsSettingsBody(body: unknown): Partial<CommandsPolicySettings> {
  const payload = readBodyObject(body, 'Command settings payload must be an object.');

  return {
    assistantEnabled: readOptionalBooleanValue(payload.assistantEnabled, 'assistantEnabled'),
    schedulingEnabled: readOptionalBooleanValue(payload.schedulingEnabled, 'schedulingEnabled'),
    ownerTerminalEnabled: readOptionalBooleanValue(payload.ownerTerminalEnabled, 'ownerTerminalEnabled'),
    autoReplyEnabled: readOptionalBooleanValue(payload.autoReplyEnabled, 'autoReplyEnabled'),
    directRepliesEnabled: readOptionalBooleanValue(payload.directRepliesEnabled, 'directRepliesEnabled'),
    allowPrivateAssistant: readOptionalBooleanValue(payload.allowPrivateAssistant, 'allowPrivateAssistant'),
    authorizedGroupJids: readOptionalStringArrayValue(payload.authorizedGroupJids, 'authorizedGroupJids'),
    authorizedPrivateJids: readOptionalStringArrayValue(payload.authorizedPrivateJids, 'authorizedPrivateJids'),
  };
}

function readLlmSettingsBody(body: unknown): Partial<AdminSettings['llm']> {
  const payload = readBodyObject(body, 'LLM settings payload must be an object.');

  return {
    enabled: readOptionalBooleanValue(payload.enabled, 'enabled'),
    provider: readOptionalTrimmedStringValue(payload.provider, 'provider'),
    model: readOptionalTrimmedStringValue(payload.model, 'model'),
    streamingEnabled: readOptionalBooleanValue(payload.streamingEnabled, 'streamingEnabled'),
  };
}

function readCodexAuthReady(
  authRouterStatus: {
    readonly canonicalExists?: boolean;
    readonly accountCount?: number;
  } | null,
): boolean {
  if (!authRouterStatus) {
    return false;
  }

  return Boolean(authRouterStatus.canonicalExists || (authRouterStatus.accountCount ?? 0) > 0);
}

function readOpenAiCompatReadyFromEnv(): boolean {
  return Boolean(
    process.env.LUME_HUB_OPENAI_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim(),
  );
}

function readWhatsAppSettingsBody(body: unknown): Partial<WhatsAppSettings> {
  const payload = readBodyObject(body, 'WhatsApp settings payload must be an object.');

  return {
    enabled: readOptionalBooleanValue(payload.enabled, 'enabled'),
    sharedAuthWithCodex: readOptionalBooleanValue(payload.sharedAuthWithCodex, 'sharedAuthWithCodex'),
    groupDiscoveryEnabled: readOptionalBooleanValue(payload.groupDiscoveryEnabled, 'groupDiscoveryEnabled'),
    conversationDiscoveryEnabled: readOptionalBooleanValue(
      payload.conversationDiscoveryEnabled,
      'conversationDiscoveryEnabled',
    ),
  };
}

function readWeeklyPlannerUpsertBody(body: unknown): WeeklyPlannerUpsertInput {
  const payload = readBodyObject(body, 'Schedule payload must be an object.');

  return {
    eventId: readOptionalTrimmedStringValue(payload.eventId, 'eventId'),
    weekId: readOptionalTrimmedStringValue(payload.weekId, 'weekId'),
    groupJid: readRequiredStringValue(payload.groupJid, 'groupJid'),
    title: readRequiredStringValue(payload.title, 'title'),
    dayLabel: readOptionalTrimmedStringValue(payload.dayLabel, 'dayLabel'),
    localDate: readOptionalTrimmedStringValue(payload.localDate, 'localDate'),
    startTime: readRequiredStringValue(payload.startTime, 'startTime'),
    durationMinutes: readRequiredPositiveIntegerValue(payload.durationMinutes, 'durationMinutes'),
    notes:
      payload.notes === null
        ? null
        : readOptionalTrimmedStringValue(payload.notes, 'notes'),
    timeZone: readOptionalTrimmedStringValue(payload.timeZone, 'timeZone'),
    notificationRules: Array.isArray(payload.notificationRules)
      ? (payload.notificationRules as WeeklyPlannerUpsertInput['notificationRules'])
      : undefined,
  };
}

function readLegacyScheduleImportBody(body: unknown): LegacyScheduleImportInput {
  const payload = readBodyObject(body, 'Legacy schedule import payload must be an object.');
  const fileName = readOptionalTrimmedStringValue(payload.fileName, 'fileName');
  const filePath = readOptionalTrimmedStringValue(payload.filePath, 'filePath');

  if (!fileName && !filePath) {
    throw new ApiError(400, 'fileName or filePath is required.');
  }

  return {
    fileName,
    filePath,
    defaultDurationMinutes: readOptionalPositiveIntegerValue(payload.defaultDurationMinutes, 'defaultDurationMinutes'),
    requestedBy: readOptionalTrimmedStringValue(payload.requestedBy, 'requestedBy') ?? null,
  };
}

function readDistributionPreviewBody(body: unknown): {
  readonly sourceMessageId: string;
  readonly personId?: string;
  readonly identifiers?: readonly { readonly kind: string; readonly value: string }[];
  readonly messageText?: string;
  readonly targetGroupJids?: readonly string[];
} {
  const payload = readBodyObject(body, 'Distribution preview payload must be an object.');

  return {
    sourceMessageId:
      readOptionalTrimmedStringValue(payload.sourceMessageId, 'sourceMessageId') ??
      `manual-preview-${randomUUID()}`,
    personId: readOptionalTrimmedStringValue(payload.personId, 'personId'),
    identifiers: readOptionalIdentifiers(payload.identifiers, 'identifiers'),
    messageText: readOptionalTrimmedStringValue(payload.messageText, 'messageText'),
    targetGroupJids: readOptionalStringArrayValue(payload.targetGroupJids, 'targetGroupJids'),
  };
}

function readDistributionExecutionBody(body: unknown): {
  readonly sourceMessageId: string;
  readonly personId?: string;
  readonly identifiers?: readonly { readonly kind: string; readonly value: string }[];
  readonly targetGroupJids?: readonly string[];
  readonly content: DistributionContentInput;
  readonly mode: 'dry_run' | 'confirmed';
} {
  const preview = readDistributionPreviewBody(body);
  const payload = readBodyObject(body, 'Distribution payload must be an object.');
  const mode = readOptionalTrimmedStringValue(payload.mode, 'mode') ?? 'dry_run';
  const assetId = readOptionalTrimmedStringValue(payload.assetId, 'assetId');
  const caption = readOptionalTrimmedStringValue(payload.caption, 'caption');

  if (mode !== 'dry_run' && mode !== 'confirmed') {
    throw new ApiError(400, "mode must be 'dry_run' or 'confirmed'.");
  }

  return {
    ...preview,
    targetGroupJids: preview.targetGroupJids,
    content: assetId
      ? {
          kind: 'media',
          assetId,
          caption: caption ?? null,
        }
      : {
          kind: 'text',
          messageText: readRequiredStringValue(payload.messageText, 'messageText'),
        },
    mode,
  };
}

function readWorkspaceAgentRunBody(body: unknown): {
  readonly prompt: string;
  readonly mode: 'plan' | 'apply';
  readonly filePaths?: readonly string[];
  readonly confirmedApply?: boolean;
  readonly requestedBy?: string;
} {
  const payload = readBodyObject(body, 'Workspace agent payload must be an object.');
  const mode = readOptionalTrimmedStringValue(payload.mode, 'mode') ?? 'apply';

  if (mode !== 'plan' && mode !== 'apply') {
    throw new ApiError(400, "mode must be 'plan' or 'apply'.");
  }

  return {
    prompt: readRequiredStringValue(payload.prompt, 'prompt'),
    mode,
    filePaths: readOptionalStringArrayValue(payload.filePaths, 'filePaths'),
    confirmedApply: readOptionalBooleanValue(payload.confirmedApply, 'confirmedApply'),
    requestedBy: readOptionalTrimmedStringValue(payload.requestedBy, 'requestedBy'),
  };
}

function readLlmChatBody(body: unknown): LlmChatInput {
  const payload = readBodyObject(body, 'LLM chat payload must be an object.');

  return {
    text: readRequiredStringValue(payload.text, 'text'),
    intent: readOptionalTrimmedStringValue(payload.intent, 'intent') ?? null,
    contextSummary: readOptionalStringArrayValue(payload.contextSummary, 'contextSummary'),
    domainFacts: readOptionalStringArrayValue(payload.domainFacts, 'domainFacts'),
  };
}

function readAssistantScheduleBody(
  body: unknown,
  requirePreviewFingerprint: boolean,
): {
  readonly text: string;
  readonly groupJid: string;
  readonly personId?: string;
  readonly senderDisplayName?: string;
  readonly weekId?: string;
  readonly requestedAccessMode: CalendarAccessMode;
  readonly previewFingerprint?: string;
} {
  const payload = readBodyObject(body, 'Assistant scheduling payload must be an object.');
  const requestedAccessMode = readOptionalTrimmedStringValue(payload.requestedAccessMode, 'requestedAccessMode') ?? 'read_write';

  if (requestedAccessMode !== 'read' && requestedAccessMode !== 'read_write') {
    throw new ApiError(400, "requestedAccessMode must be 'read' or 'read_write'.");
  }

  const previewFingerprint = readOptionalTrimmedStringValue(payload.previewFingerprint, 'previewFingerprint');

  if (requirePreviewFingerprint && !previewFingerprint) {
    throw new ApiError(400, 'previewFingerprint is required to apply a scheduling change.');
  }

  return {
    text: readRequiredStringValue(payload.text, 'text'),
    groupJid: readRequiredStringValue(payload.groupJid, 'groupJid'),
    personId: readOptionalTrimmedStringValue(payload.personId, 'personId'),
    senderDisplayName: readOptionalTrimmedStringValue(payload.senderDisplayName, 'senderDisplayName'),
    weekId: readOptionalTrimmedStringValue(payload.weekId, 'weekId'),
    requestedAccessMode,
    previewFingerprint: previewFingerprint ?? undefined,
  };
}

function readBooleanBodyField(body: unknown, fieldName: string): boolean {
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>)[fieldName] !== 'boolean') {
    throw new ApiError(400, `${fieldName} must be a boolean.`);
  }

  return (body as Record<string, boolean>)[fieldName];
}

function readStringBodyField(body: unknown, fieldName: string): string {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, `${fieldName} payload must be an object.`);
  }

  const value = (body as Record<string, unknown>)[fieldName];

  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalStringBodyField(body: unknown, fieldName: string): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const value = (body as Record<string, unknown>)[fieldName];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ApiError(400, `${fieldName} must be a string when provided.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalQueryString(
  query: Record<string, string | readonly string[]>,
  fieldName: string,
): string | undefined {
  const value = query[fieldName];
  const candidate = Array.isArray(value) ? value[0] : value;

  if (candidate === undefined) {
    return undefined;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalBooleanQuery(
  query: Record<string, string | readonly string[]>,
  fieldName: string,
): boolean | undefined {
  const value = readOptionalQueryString(query, fieldName);

  if (value === undefined) {
    return undefined;
  }

  if (value === '1' || value.toLowerCase() === 'true') {
    return true;
  }

  if (value === '0' || value.toLowerCase() === 'false') {
    return false;
  }

  throw new ApiError(400, `${fieldName} must be true or false when provided.`);
}

function readOptionalPositiveIntegerQuery(
  query: Record<string, string | readonly string[]>,
  fieldName: string,
): number | undefined {
  const value = readOptionalQueryString(query, fieldName);

  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive integer when provided.`);
  }

  return parsed;
}

function readBodyObject(body: unknown, message: string): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, message);
  }

  return body as Record<string, unknown>;
}

function readRequiredStringValue(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(400, `${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalBooleanValue(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new ApiError(400, `${fieldName} must be a boolean.`);
  }

  return value;
}

function readRequiredQueryString(
  query: Record<string, string | readonly string[]>,
  fieldName: string,
): string {
  const value = readOptionalQueryString(query, fieldName);

  if (!value || value.trim().length === 0) {
    throw new ApiError(400, `${fieldName} query parameter is required.`);
  }

  return value.trim();
}

function readOptionalTrimmedStringValue(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ApiError(400, `${fieldName} must be a string when provided.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalStringArrayValue(value: unknown, fieldName: string): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new ApiError(400, `${fieldName} must be an array of strings.`);
  }

  return normaliseStringArray(
    value.map((entry) => {
      if (typeof entry !== 'string') {
        throw new ApiError(400, `${fieldName} must be an array of strings.`);
      }

      return entry;
    }),
  );
}

function readRequiredPositiveIntegerValue(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive integer.`);
  }

  return value;
}

function readOptionalPositiveIntegerValue(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readRequiredPositiveIntegerValue(value, fieldName);
}

function readOptionalIdentifiers(
  value: unknown,
  fieldName: string,
): readonly { readonly kind: string; readonly value: string }[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new ApiError(400, `${fieldName} must be an array.`);
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new ApiError(400, `${fieldName}[${index}] must be an object.`);
    }

    return {
      kind: readRequiredStringValue((entry as Record<string, unknown>).kind, `${fieldName}[${index}].kind`),
      value: readRequiredStringValue((entry as Record<string, unknown>).value, `${fieldName}[${index}].value`),
    };
  });
}

function readRolesArray(value: unknown): readonly PersonRole[] {
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'globalRoles must be an array.');
  }

  return normaliseRoles(
    value.map((entry) => {
      if (!isPersonRole(entry)) {
        throw new ApiError(400, "globalRoles entries must be 'member' or 'app_owner'.");
      }

      return entry;
    }),
  );
}

function normaliseRoles(roles: readonly PersonRole[]): readonly PersonRole[] {
  return [...new Set<PersonRole>(roles.length > 0 ? [...roles] : ['member'])];
}

function normaliseStringArray(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isPersonRole(value: unknown): value is PersonRole {
  return value === 'member' || value === 'app_owner';
}

function mapInstruction(instruction: Instruction) {
  const distributionPayload = readDistributionPayloadFromInstruction(instruction);
  const actionCounts: Record<Instruction['actions'][number]['status'], number> = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const action of instruction.actions) {
    actionCounts[action.status] += 1;
  }

  return {
    instructionId: instruction.instructionId,
    sourceType: instruction.sourceType,
    sourceMessageId: instruction.sourceMessageId,
    mode: instruction.mode,
    status: instruction.status,
    targetGroupJids: instruction.actions
      .map((action) => action.targetGroupJid)
      .filter((groupJid): groupJid is string => typeof groupJid === 'string'),
    contentKind: distributionPayload?.kind ?? null,
    mediaAssetId: distributionPayload?.kind === 'media' ? distributionPayload.assetId : null,
    caption: distributionPayload?.kind === 'media' ? distributionPayload.caption ?? null : null,
    messagePreview: distributionPayload?.kind === 'text' ? distributionPayload.messageText : null,
    actionCounts,
    createdAt: instruction.createdAt,
    updatedAt: instruction.updatedAt,
  };
}

function readDistributionPayloadFromInstruction(
  instruction: Instruction,
): Extract<DistributionContentInput, { readonly kind: 'text' }> | Extract<DistributionContentInput, { readonly kind: 'media' }> | null {
  const firstPayload = instruction.actions[0]?.payload as
    | {
        readonly kind?: string;
        readonly messageText?: unknown;
        readonly assetId?: unknown;
        readonly caption?: unknown;
      }
    | undefined;

  if (!firstPayload) {
    return null;
  }

  if (firstPayload.kind === 'media' && typeof firstPayload.assetId === 'string' && firstPayload.assetId.trim()) {
    return {
      kind: 'media',
      assetId: firstPayload.assetId.trim(),
      caption: typeof firstPayload.caption === 'string' && firstPayload.caption.trim() ? firstPayload.caption.trim() : null,
    };
  }

  if (firstPayload.kind === 'text' && typeof firstPayload.messageText === 'string' && firstPayload.messageText.trim()) {
    return {
      kind: 'text',
      messageText: firstPayload.messageText.trim(),
    };
  }

  return null;
}

function normaliseHttpMethod(method: string | undefined): HttpMethod | null {
  switch (method?.toUpperCase()) {
    case 'GET':
    case 'POST':
    case 'PUT':
    case 'PATCH':
    case 'DELETE':
      return method.toUpperCase() as HttpMethod;
    default:
      return null;
  }
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

function parseRequestBody(rawBody: string, contentTypeHeader: string | readonly string[] | undefined): unknown {
  if (rawBody.length === 0) {
    return undefined;
  }

  const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader.join(', ') : (contentTypeHeader ?? '');

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawBody);
    } catch {
      throw new ApiError(400, 'Request body must be valid JSON.');
    }
  }

  return rawBody;
}

function mapHeaders(headers: IncomingMessage['headers']): Record<string, string> {
  const entries = Object.entries(headers).map(([key, value]) => [
    key.toLowerCase(),
    Array.isArray(value) ? value.join(', ') : (value ?? ''),
  ]);

  return Object.fromEntries(entries);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveStaticFilePath(rootPath: string, pathname: string): string | null {
  const safeRootPath = resolve(rootPath);
  const safeRootPrefix = safeRootPath.endsWith('/') ? safeRootPath : `${safeRootPath}/`;
  const candidatePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const nextPath = resolve(safeRootPath, normalize(candidatePath));

  if (nextPath !== safeRootPath && !nextPath.startsWith(safeRootPrefix)) {
    return null;
  }

  return nextPath;
}

function resolveContentType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.ico':
      return 'image/x-icon';
    case '.jpeg':
    case '.jpg':
      return 'image/jpeg';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function injectFrontendBootConfig(html: string, config: HttpFrontendBootConfig): string {
  const serializedConfig = JSON.stringify({
    defaultMode: config.defaultMode ?? 'live',
    apiBaseUrl: config.apiBaseUrl,
    webSocketPath: config.webSocketPath ?? '/ws',
  });
  const injection = `<script>window.__LUMEHUB_BOOT_CONFIG__ = ${serializedConfig};</script>`;

  return html.includes('</head>') ? html.replace('</head>', `${injection}</head>`) : `${injection}${html}`;
}
