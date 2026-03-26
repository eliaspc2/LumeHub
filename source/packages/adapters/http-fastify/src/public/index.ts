import { randomUUID } from 'node:crypto';

import type { AdminConfigModuleContract } from '@lume-hub/admin-config';
import type { AudienceRoutingModuleContract } from '@lume-hub/audience-routing';
import type { CodexAuthRouterModuleContract } from '@lume-hub/codex-auth-router';
import type { GroupCalendarAccessPolicy, GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { HealthMonitorModuleContract } from '@lume-hub/health-monitor';
import type { HostLifecycleModuleContract } from '@lume-hub/host-lifecycle';
import type { Instruction, InstructionQueueModuleContract } from '@lume-hub/instruction-queue';
import type { SystemPowerModuleContract } from '@lume-hub/system-power';
import type { WatchdogModuleContract } from '@lume-hub/watchdog';

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
  readonly adminConfig: Pick<AdminConfigModuleContract, 'getSettings' | 'updateUiSettings'>;
  readonly audienceRouting: Pick<AudienceRoutingModuleContract, 'listSenderAudienceRules' | 'upsertSenderAudienceRule'>;
  readonly codexAuthRouter?: Pick<CodexAuthRouterModuleContract, 'forceSwitch' | 'getStatus'>;
  readonly groupDirectory: Pick<
    GroupDirectoryModuleContract,
    'listGroups' | 'replaceGroupOwners' | 'updateCalendarAccessPolicy'
  >;
  readonly healthMonitor: Pick<HealthMonitorModuleContract, 'getHealthSnapshot' | 'getReadiness'>;
  readonly hostLifecycle: Pick<
    HostLifecycleModuleContract,
    'enableStartWithSystem' | 'disableStartWithSystem' | 'getHostCompanionStatus'
  >;
  readonly instructionQueue: Pick<InstructionQueueModuleContract, 'listInstructions'>;
  readonly systemPower: Pick<SystemPowerModuleContract, 'getPowerStatus' | 'updatePowerPolicy'>;
  readonly watchdog: Pick<WatchdogModuleContract, 'listIssues' | 'resolveIssue'>;
}

export interface FastifyHttpServerConfig {
  readonly modules: HttpApiModules;
  readonly uiEventPublisher?: UiEventPublisherLike;
  readonly routeRegistrar?: RouteRegistrar;
  readonly requestContextFactory?: RequestContextFactory;
  readonly errorHandler?: ApiErrorHandler;
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
      path: '/api/groups',
      handler: async () => this.modules.groupDirectory.listGroups(),
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
      method: 'GET',
      path: '/api/routing/distributions',
      handler: async () => (await this.modules.instructionQueue.listInstructions()).map((instruction) => mapInstruction(instruction)),
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
    const [health, readiness, groups, rules, instructions, issues] = await Promise.all([
      this.modules.healthMonitor.getHealthSnapshot(),
      this.modules.healthMonitor.getReadiness(),
      this.modules.groupDirectory.listGroups(),
      this.modules.audienceRouting.listSenderAudienceRules(),
      this.modules.instructionQueue.listInstructions(),
      this.modules.watchdog.listIssues({
        status: 'open',
      }),
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
      },
    };
  }

  private async getSettingsSnapshot() {
    const [adminSettings, powerStatus, hostStatus, authRouterStatus] = await Promise.all([
      this.modules.adminConfig.getSettings(),
      this.modules.systemPower.getPowerStatus(),
      this.modules.hostLifecycle.getHostCompanionStatus(),
      this.modules.codexAuthRouter?.getStatus() ?? Promise.resolve(null),
    ]);

    return {
      adminSettings,
      powerStatus,
      hostStatus,
      authRouterStatus,
    };
  }

  private publish(topic: string, payload: unknown): void {
    this.uiEventPublisher?.publish(topic, payload);
  }
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

function mapInstruction(instruction: Instruction) {
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
    actionCounts,
    createdAt: instruction.createdAt,
    updatedAt: instruction.updatedAt,
  };
}
