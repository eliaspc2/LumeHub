import type {
  AdminSettings,
  CommandsPolicySettings,
  ConversationAuditRecord,
  DashboardSnapshot,
  DistributionExecutionResult,
  DistributionPlan,
  DistributionSummary,
  FrontendApiRequest,
  FrontendApiResponse,
  FrontendApiTransport,
  FrontendUiEvent,
  Group,
  GroupContextPreviewSnapshot,
  GroupCalendarAccessPolicy,
  GroupIntelligenceSnapshot,
  GroupKnowledgeDocumentSnapshot,
  GroupOwnerAssignmentInput,
  Instruction,
  LlmChatInput,
  LlmChatResult,
  LlmModelDescriptor,
  LlmRunLogEntry,
  MediaAssetSnapshot,
  Person,
  PersonRole,
  SettingsSnapshot,
  SenderAudienceRule,
  StatusSnapshot,
  WhatsAppWorkspaceSnapshot,
  WhatsAppConversationSummary,
  WhatsAppGroupSummary,
  WatchdogIssue,
  WeeklyPlannerEventSummary,
  WeeklyPlannerSnapshot,
} from '@lume-hub/frontend-api-client';

export type FrontendTransportMode = 'demo' | 'live';

export interface FrontendBootConfig {
  readonly defaultMode?: FrontendTransportMode;
  readonly apiBaseUrl?: string;
  readonly webSocketPath?: string;
}

declare global {
  interface Window {
    __LUMEHUB_BOOT_CONFIG__?: FrontendBootConfig;
  }
}

const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  schemaVersion: 1,
  commands: {
    assistantEnabled: true,
    schedulingEnabled: true,
    ownerTerminalEnabled: true,
    autoReplyEnabled: false,
    directRepliesEnabled: false,
    allowPrivateAssistant: true,
    authorizedGroupJids: [],
    authorizedPrivateJids: [],
  },
  whatsapp: {
    enabled: true,
    sharedAuthWithCodex: true,
    groupDiscoveryEnabled: true,
    conversationDiscoveryEnabled: true,
  },
  llm: {
    enabled: false,
    provider: 'codex-oauth',
    model: 'gpt-5.4',
    streamingEnabled: true,
  },
  ui: {
    defaultNotificationRules: [
      {
        kind: 'relative_before_event',
        daysBeforeEvent: 1,
        offsetMinutesBeforeEvent: 0,
        enabled: true,
        label: '24h antes',
      },
      {
        kind: 'relative_before_event',
        daysBeforeEvent: 0,
        offsetMinutesBeforeEvent: 30,
        enabled: true,
        label: '30 min antes',
      },
    ],
  },
  updatedAt: null,
};

export function createInitialTransportMode(
  locationLike: Pick<Location, 'search'> = window.location,
  bootConfig: FrontendBootConfig = readFrontendBootConfig(),
): FrontendTransportMode {
  const params = new URLSearchParams(locationLike.search);

  if (params.get('mode') === 'live') {
    return 'live';
  }

  if (params.get('mode') === 'demo') {
    return 'demo';
  }

  return bootConfig.defaultMode === 'live' ? 'live' : 'demo';
}

export function createFrontendTransport(
  mode: FrontendTransportMode,
  options: {
    readonly baseUrl?: string;
    readonly webSocketPath?: string;
  } = {},
): FrontendApiTransport {
  if (mode === 'live') {
    const bootConfig = readFrontendBootConfig();

    return new BrowserFetchFrontendApiTransport(options.baseUrl ?? bootConfig.apiBaseUrl, {
      webSocketPath: options.webSocketPath ?? bootConfig.webSocketPath,
    });
  }

  return new DemoFrontendApiTransport();
}

class BrowserFetchFrontendApiTransport implements FrontendApiTransport {
  private readonly listeners = new Set<(event: FrontendUiEvent) => void>();
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;

  constructor(
    private readonly baseUrl = window.location.origin,
    private readonly options: {
      readonly webSocketPath?: string;
    } = {},
  ) {}

  async request<T = unknown>(request: FrontendApiRequest): Promise<FrontendApiResponse<T>> {
    const response = await fetch(new URL(request.path, this.baseUrl), {
      method: request.method,
      headers: {
        ...(request.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(request.headers ?? {}),
      },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
    const rawBody = await response.text();
    const body = parseHttpBody<T>(rawBody, response.headers.get('content-type'));

    return {
      statusCode: response.status,
      body,
    };
  }

  subscribe(listener: (event: FrontendUiEvent) => void): () => void {
    this.listeners.add(listener);
    this.ensureSocket();

    return () => {
      this.listeners.delete(listener);

      if (this.listeners.size === 0) {
        this.disposeSocket();
      }
    };
  }

  private ensureSocket(): void {
    if (this.socket || this.listeners.size === 0) {
      return;
    }

    const socket = new WebSocket(this.resolveWebSocketUrl());
    this.socket = socket;

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as FrontendUiEvent;
        this.listeners.forEach((listener) => listener(payload));
      } catch {}
    });

    socket.addEventListener('close', () => {
      this.socket = null;

      if (this.listeners.size === 0 || this.reconnectTimer !== null) {
        return;
      }

      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        this.ensureSocket();
      }, 800);
    });

    socket.addEventListener('error', () => {
      try {
        socket.close();
      } catch {}
    });
  }

  private disposeSocket(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!this.socket) {
      return;
    }

    try {
      this.socket.close();
    } catch {}

    this.socket = null;
  }

  private resolveWebSocketUrl(): string {
    const wsPath = normaliseWebSocketPath(this.options.webSocketPath ?? '/ws');
    const baseUrl = new URL(this.baseUrl, window.location.origin);
    const protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${baseUrl.host}${wsPath}`;
  }
}

class DemoFrontendApiTransport implements FrontendApiTransport {
  private readonly listeners = new Set<(event: FrontendUiEvent) => void>();
  private readonly state = createDemoState();

  constructor() {
    setTimeout(() => {
      this.emit('preview.ready', {
        mode: 'demo',
        message: 'Preview demo pronta para validar a nova shell do frontend.',
      });
    }, 300);
  }

  async request<T = unknown>(request: FrontendApiRequest): Promise<FrontendApiResponse<T>> {
    await delay(140);

    const pathname = new URL(request.path, 'http://lumehub.preview').pathname;

    if (request.method === 'GET' && pathname === '/api/dashboard') {
      return this.ok(buildDashboardSnapshot(this.state));
    }

    if (request.method === 'GET' && pathname === '/api/status') {
      return this.ok(buildStatusSnapshot(this.state));
    }

    if (request.method === 'GET' && pathname === '/api/schedules') {
      return this.ok(buildWeeklyPlannerSnapshot(this.state));
    }

    if (request.method === 'POST' && pathname === '/api/schedules') {
      const schedule = upsertDemoSchedule(this.state, request.body as Record<string, unknown>);
      this.emit('schedules.updated', {
        eventId: schedule.eventId,
        groupJid: schedule.groupJid,
        weekId: schedule.weekId,
      });
      return this.ok(schedule);
    }

    if (request.method === 'GET' && pathname === '/api/groups') {
      return this.ok(this.state.groups);
    }

    if (request.method === 'GET' && pathname === '/api/media/assets') {
      return this.ok(this.state.mediaAssets);
    }

    const mediaAssetMatch = matchParameterizedPath(pathname, '/api/media/assets/:assetId');

    if (request.method === 'GET' && mediaAssetMatch) {
      const asset = this.state.mediaAssets.find((candidate) => candidate.assetId === mediaAssetMatch.assetId);
      return asset
        ? this.ok(asset)
        : this.error(404, `Demo media asset ${mediaAssetMatch.assetId} not found.`);
    }

    const groupIntelligenceMatch = matchParameterizedPath(pathname, '/api/groups/:groupJid/intelligence');
    const groupInstructionsMatch = matchParameterizedPath(pathname, '/api/groups/:groupJid/llm-instructions');
    const groupKnowledgeUpsertMatch = matchParameterizedPath(pathname, '/api/groups/:groupJid/knowledge/documents');
    const groupKnowledgeDeleteMatch = matchParameterizedPath(
      pathname,
      '/api/groups/:groupJid/knowledge/documents/:documentId',
    );
    const groupContextPreviewMatch = matchParameterizedPath(pathname, '/api/groups/:groupJid/context-preview');

    if (request.method === 'GET' && groupIntelligenceMatch) {
      return this.ok(buildDemoGroupIntelligenceSnapshot(this.state, groupIntelligenceMatch.groupJid));
    }

    if (request.method === 'PUT' && groupInstructionsMatch) {
      const body = request.body as { readonly content?: string };
      const entry = this.state.groupIntelligenceByGroupJid[groupInstructionsMatch.groupJid];

      if (!entry) {
        return this.error(404, `Demo group intelligence for ${groupInstructionsMatch.groupJid} not found.`);
      }

      this.state.groupIntelligenceByGroupJid[groupInstructionsMatch.groupJid] = {
        ...entry,
        instructions: typeof body.content === 'string' ? body.content : entry.instructions,
      };
      const snapshot = buildDemoGroupIntelligenceSnapshot(this.state, groupInstructionsMatch.groupJid);
      this.emit('groups.intelligence.instructions.updated', {
        groupJid: groupInstructionsMatch.groupJid,
        source: snapshot.instructions.source,
      });
      return this.ok(snapshot.instructions);
    }

    if (request.method === 'POST' && groupKnowledgeUpsertMatch) {
      const nextDocument = upsertDemoGroupKnowledgeDocument(
        this.state,
        groupKnowledgeUpsertMatch.groupJid,
        request.body as Record<string, unknown>,
      );
      this.emit('groups.knowledge.document.updated', {
        groupJid: groupKnowledgeUpsertMatch.groupJid,
        documentId: nextDocument.documentId,
        filePath: nextDocument.filePath,
      });
      return this.ok(nextDocument);
    }

    if (request.method === 'DELETE' && groupKnowledgeDeleteMatch) {
      const deleted = deleteDemoGroupKnowledgeDocument(
        this.state,
        groupKnowledgeDeleteMatch.groupJid,
        groupKnowledgeDeleteMatch.documentId,
      );
      this.emit('groups.knowledge.document.deleted', deleted);
      return this.ok(deleted);
    }

    if (request.method === 'POST' && groupContextPreviewMatch) {
      return this.ok(
        buildDemoGroupContextPreview(
          this.state,
          groupContextPreviewMatch.groupJid,
          request.body as {
            readonly text?: string;
            readonly personId?: string | null;
            readonly senderDisplayName?: string | null;
          },
        ),
      );
    }

    if (request.method === 'GET' && pathname === '/api/people') {
      return this.ok(this.state.people);
    }

    if (request.method === 'GET' && pathname === '/api/routing/rules') {
      return this.ok(this.state.routingRules);
    }

    if (request.method === 'POST' && pathname === '/api/routing/preview') {
      return this.ok(buildDemoDistributionPlan(this.state, request.body as Record<string, unknown>));
    }

    if (request.method === 'GET' && pathname === '/api/routing/distributions') {
      return this.ok(this.state.distributions);
    }

    if (request.method === 'POST' && pathname === '/api/routing/distributions') {
      const result = createDemoDistribution(this.state, request.body as Record<string, unknown>);
      this.emit('routing.distribution.created', result.instruction);
      return this.ok(result);
    }

    if (request.method === 'GET' && pathname === '/api/instruction-queue') {
      return this.ok(this.state.instructionQueue);
    }

    if (request.method === 'GET' && pathname === '/api/whatsapp/workspace') {
      return this.ok(buildWhatsAppWorkspaceSnapshot(this.state));
    }

    if (request.method === 'GET' && pathname === '/api/qr') {
      return this.ok(buildWhatsAppWorkspaceSnapshot(this.state).runtime.qr);
    }

    if (request.method === 'GET' && pathname === '/api/qr.svg') {
      return this.ok({
        svg: buildWhatsAppWorkspaceSnapshot(this.state).runtime.qr.svg,
      });
    }

    if (request.method === 'POST' && pathname === '/api/whatsapp/refresh') {
      this.emit('whatsapp.workspace.refreshed', {
        mode: 'demo',
      });
      return this.ok(buildWhatsAppWorkspaceSnapshot(this.state));
    }

    if (request.method === 'GET' && pathname === '/api/watchdog/issues') {
      return this.ok(this.state.watchdogIssues);
    }

    if (request.method === 'GET' && pathname === '/api/settings') {
      return this.ok(this.state.settings);
    }

    if (request.method === 'GET' && pathname === '/api/llm/models') {
      return this.ok(this.state.llmModels);
    }

    if (request.method === 'POST' && pathname === '/api/llm/chat') {
      const result = createDemoLlmChatResult(this.state, request.body as LlmChatInput);
      this.emit('llm.chat.completed', {
        runId: result.runId,
        providerId: result.providerId,
        modelId: result.modelId,
      });
      return this.ok(result);
    }

    if (request.method === 'GET' && pathname === '/api/logs/llm') {
      return this.ok(readRecentDemoEntries(this.state.llmRuns, request.path, 20));
    }

    if (request.method === 'GET' && pathname === '/api/logs/conversations') {
      return this.ok(readRecentDemoEntries(this.state.conversationAudit, request.path, 20));
    }

    if (request.method === 'PATCH' && pathname === '/api/settings/whatsapp') {
      this.state.settings = {
        ...this.state.settings,
        adminSettings: {
          ...this.state.settings.adminSettings,
          whatsapp: {
            ...this.state.settings.adminSettings.whatsapp,
            ...(request.body as Partial<AdminSettings['whatsapp']>),
          },
          updatedAt: new Date().toISOString(),
        },
      };
      const next = this.state.settings.adminSettings;
      this.emit('settings.whatsapp.updated', next.whatsapp);
      return this.ok(next);
    }

    if (request.method === 'PATCH' && pathname === '/api/settings/commands') {
      this.state.settings = {
        ...this.state.settings,
        adminSettings: {
          ...this.state.settings.adminSettings,
          commands: {
            ...this.state.settings.adminSettings.commands,
            ...(request.body as Partial<CommandsPolicySettings>),
          },
          updatedAt: new Date().toISOString(),
        },
      };
      const next = this.state.settings.adminSettings;
      this.emit('settings.commands.updated', next.commands);
      return this.ok(next);
    }

    const personRolesMatch = matchParameterizedPath(pathname, '/api/people/:personId/roles');

    if (request.method === 'PUT' && personRolesMatch) {
      const body = request.body as { readonly globalRoles?: readonly PersonRole[] };
      const personIndex = this.state.people.findIndex((person) => person.personId === personRolesMatch.personId);

      if (personIndex < 0) {
        return this.error(404, `Demo person ${personRolesMatch.personId} not found.`);
      }

      const person = this.state.people[personIndex];
      const updatedPerson: Person = {
        ...person,
        globalRoles: [...(body.globalRoles ?? [])],
        updatedAt: new Date().toISOString(),
      };
      this.state.people.splice(personIndex, 1, updatedPerson);
      this.emit('people.roles.updated', updatedPerson);
      return this.ok(updatedPerson);
    }

    const groupOwnersMatch = matchParameterizedPath(pathname, '/api/groups/:groupJid/owners');

    if (request.method === 'PUT' && groupOwnersMatch) {
      const groupIndex = this.state.groups.findIndex((group) => group.groupJid === groupOwnersMatch.groupJid);

      if (groupIndex < 0) {
        return this.error(404, `Demo group ${groupOwnersMatch.groupJid} not found.`);
      }

      const body = request.body as { readonly owners?: readonly GroupOwnerAssignmentInput[] };
      const owners = (body.owners ?? []).map((owner) => ({
        personId: owner.personId,
        assignedAt: owner.assignedAt ?? new Date().toISOString(),
        assignedBy: owner.assignedBy ?? 'person-marta',
      }));
      this.state.groups[groupIndex] = {
        ...this.state.groups[groupIndex],
        groupOwners: owners,
      };
      this.emit('groups.owners.updated', {
        groupJid: groupOwnersMatch.groupJid,
        owners,
      });
      return this.ok(owners);
    }

    const groupAccessMatch = matchParameterizedPath(pathname, '/api/groups/:groupJid/calendar-access');
    const scheduleMatch = matchParameterizedPath(pathname, '/api/schedules/:eventId');
    const instructionRetryMatch = matchParameterizedPath(pathname, '/api/instruction-queue/:instructionId/retry');

    if (request.method === 'PATCH' && groupAccessMatch) {
      const groupIndex = this.state.groups.findIndex((group) => group.groupJid === groupAccessMatch.groupJid);

      if (groupIndex < 0) {
        return this.error(404, `Demo group ${groupAccessMatch.groupJid} not found.`);
      }

      const body = request.body as Partial<GroupCalendarAccessPolicy>;
      const nextPolicy: GroupCalendarAccessPolicy = {
        ...this.state.groups[groupIndex].calendarAccessPolicy,
        ...body,
      };
      this.state.groups[groupIndex] = {
        ...this.state.groups[groupIndex],
        calendarAccessPolicy: nextPolicy,
      };
      this.emit('groups.calendar_access.updated', {
        groupJid: groupAccessMatch.groupJid,
        calendarAccessPolicy: nextPolicy,
      });
      return this.ok(nextPolicy);
    }

    if (request.method === 'PATCH' && scheduleMatch) {
      const schedule = upsertDemoSchedule(this.state, {
        ...(request.body as Record<string, unknown>),
        eventId: scheduleMatch.eventId,
      });
      this.emit('schedules.updated', {
        eventId: schedule.eventId,
        groupJid: schedule.groupJid,
        weekId: schedule.weekId,
      });
      return this.ok(schedule);
    }

    if (request.method === 'DELETE' && scheduleMatch) {
      const index = this.state.scheduleEvents.findIndex((event) => event.eventId === scheduleMatch.eventId);
      const deleted = index >= 0;

      if (deleted) {
        this.state.scheduleEvents.splice(index, 1);
      }

      this.emit('schedules.deleted', {
        eventId: scheduleMatch.eventId,
        deleted,
      });
      return this.ok({ deleted });
    }

    if (request.method === 'POST' && instructionRetryMatch) {
      const index = this.state.instructionQueue.findIndex(
        (instruction) => instruction.instructionId === instructionRetryMatch.instructionId,
      );

      if (index < 0) {
        return this.error(404, `Demo instruction ${instructionRetryMatch.instructionId} not found.`);
      }

      const instruction = this.state.instructionQueue[index];
      const retriedInstruction: Instruction = {
        ...instruction,
        status: 'queued',
        actions: instruction.actions.map((action) =>
          action.status === 'failed'
            ? {
                ...action,
                status: 'pending',
                lastError: null,
                result: null,
                completedAt: null,
              }
            : action,
        ),
        updatedAt: new Date().toISOString(),
      };
      this.state.instructionQueue.splice(index, 1, retriedInstruction);
      this.emit('instruction.retry.accepted', {
        instructionId: retriedInstruction.instructionId,
        status: retriedInstruction.status,
      });
      return this.ok(retriedInstruction);
    }

    if (request.method === 'POST' && pathname === '/api/send') {
      const payload = request.body as Record<string, unknown>;
      const sendResult = {
        messageId: `demo-send-${Date.now()}`,
        chatJid: String(payload.chatJid ?? ''),
        acceptedAt: new Date().toISOString(),
        ...(typeof payload.idempotencyKey === 'string' ? { idempotencyKey: payload.idempotencyKey } : {}),
      };
      this.emit('send.accepted', sendResult);
      return this.ok(sendResult);
    }

    return this.error(404, `Demo transport has no handler for ${request.method} ${pathname}.`);
  }

  subscribe(listener: (event: FrontendUiEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(topic: string, payload: unknown): void {
    const event: FrontendUiEvent = {
      eventId: `demo-${topic}-${Math.random().toString(16).slice(2)}`,
      topic,
      emittedAt: new Date().toISOString(),
      payload,
    };

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private ok<T>(body: unknown): FrontendApiResponse<T> {
    return {
      statusCode: 200,
      body: structuredClone(body) as T,
    };
  }

  private error<T>(statusCode: number, error: string): FrontendApiResponse<T> {
    return {
      statusCode,
      body: {
        error,
      } as T,
    };
  }
}

interface DemoState {
  groups: Group[];
  groupIntelligenceByGroupJid: Record<string, DemoGroupIntelligenceEntry>;
  mediaAssets: MediaAssetSnapshot[];
  people: Person[];
  routingRules: SenderAudienceRule[];
  distributions: DistributionSummary[];
  instructionQueue: Instruction[];
  scheduleEvents: WeeklyPlannerEventSummary[];
  watchdogIssues: WatchdogIssue[];
  llmModels: readonly LlmModelDescriptor[];
  llmRuns: LlmRunLogEntry[];
  conversationAudit: ConversationAuditRecord[];
  readonly externalPrivateConversations: readonly WhatsAppConversationSummary[];
  settings: SettingsSnapshot;
}

interface DemoGroupIntelligenceEntry {
  readonly instructions: string;
  readonly knowledgeDocuments: GroupKnowledgeDocumentSnapshot[];
}

function createDemoState(): DemoState {
  const now = new Date();
  const iso = (minutesOffset = 0) => new Date(now.getTime() + minutesOffset * 60_000).toISOString();

  const groups: Group[] = [
    {
      groupJid: '120363407086801381@g.us',
      preferredSubject: 'Ballet Iniciacao',
      aliases: ['Ballet Basico'],
      courseId: 'ballet-init',
      groupOwners: [{ personId: 'person-ana', assignedAt: iso(-1_200), assignedBy: 'person-marta' }],
      calendarAccessPolicy: { group: 'read', groupOwner: 'read_write', appOwner: 'read_write' },
      lastRefreshedAt: iso(-18),
    },
    {
      groupJid: '120363407086801382@g.us',
      preferredSubject: 'Contemporaneo Jovens',
      aliases: ['Contemporaneo'],
      courseId: 'contemp-jovens',
      groupOwners: [{ personId: 'person-tiago', assignedAt: iso(-980), assignedBy: 'person-marta' }],
      calendarAccessPolicy: { group: 'read', groupOwner: 'read_write', appOwner: 'read_write' },
      lastRefreshedAt: iso(-14),
    },
    {
      groupJid: '120363407086801383@g.us',
      preferredSubject: 'Pilates Adultos',
      aliases: ['Pilates 18h'],
      courseId: 'pilates-adultos',
      groupOwners: [{ personId: 'person-lucia', assignedAt: iso(-720), assignedBy: 'person-marta' }],
      calendarAccessPolicy: { group: 'read', groupOwner: 'read_write', appOwner: 'read_write' },
      lastRefreshedAt: iso(-22),
    },
    {
      groupJid: '120363407086801384@g.us',
      preferredSubject: 'Barra de Chao',
      aliases: ['Barra'],
      courseId: 'barra-chao',
      groupOwners: [],
      calendarAccessPolicy: { group: 'read', groupOwner: 'read_write', appOwner: 'read_write' },
      lastRefreshedAt: iso(-35),
    },
    {
      groupJid: '120363407086801385@g.us',
      preferredSubject: 'Jazz Teens',
      aliases: ['Jazz'],
      courseId: 'jazz-teens',
      groupOwners: [{ personId: 'person-rita', assignedAt: iso(-630), assignedBy: 'person-marta' }],
      calendarAccessPolicy: { group: 'read', groupOwner: 'read_write', appOwner: 'read_write' },
      lastRefreshedAt: iso(-9),
    },
    {
      groupJid: '120363407086801386@g.us',
      preferredSubject: 'Teatro Musical',
      aliases: ['Musical'],
      courseId: 'teatro-musical',
      groupOwners: [{ personId: 'person-joao', assignedAt: iso(-580), assignedBy: 'person-marta' }],
      calendarAccessPolicy: { group: 'read', groupOwner: 'read_write', appOwner: 'read_write' },
      lastRefreshedAt: iso(-27),
    },
  ];

  const routingRules: SenderAudienceRule[] = [
    {
      ruleId: 'rule-ana-ballet',
      personId: 'person-ana',
      identifiers: [{ kind: 'whatsapp_jid', value: '351910000001@s.whatsapp.net' }],
      targetGroupJids: [groups[0].groupJid, groups[1].groupJid],
      targetCourseIds: [],
      targetDisciplineCodes: ['BALLET'],
      enabled: true,
      requiresConfirmation: true,
      notes: 'Distribui avisos para iniciacao e contemporaneo.',
      createdAt: iso(-4_000),
      updatedAt: iso(-240),
    },
    {
      ruleId: 'rule-lucia-pilates',
      personId: 'person-lucia',
      identifiers: [{ kind: 'whatsapp_jid', value: '351910000002@s.whatsapp.net' }],
      targetGroupJids: [groups[2].groupJid],
      targetCourseIds: ['pilates-adultos'],
      targetDisciplineCodes: ['PILATES'],
      enabled: true,
      requiresConfirmation: false,
      notes: 'Rotina de distribuicao direta para aulas de pilates.',
      createdAt: iso(-3_400),
      updatedAt: iso(-95),
    },
    {
      ruleId: 'rule-rita-jazz',
      personId: 'person-rita',
      identifiers: [{ kind: 'whatsapp_jid', value: '351910000003@s.whatsapp.net' }],
      targetGroupJids: [groups[4].groupJid, groups[5].groupJid],
      targetCourseIds: ['jazz-teens'],
      targetDisciplineCodes: ['JAZZ', 'MUSICAL'],
      enabled: true,
      requiresConfirmation: true,
      notes: 'Usada para comunicados de ensaios e ajustes de horario.',
      createdAt: iso(-2_900),
      updatedAt: iso(-65),
    },
  ];

  const distributions: DistributionSummary[] = [
    {
      instructionId: 'instruction-20260327-001',
      sourceType: 'incoming_message',
      sourceMessageId: 'wamid.demo.001',
      mode: 'confirmed',
      status: 'completed',
      targetGroupJids: [groups[0].groupJid, groups[1].groupJid],
      actionCounts: {
        pending: 0,
        running: 0,
        completed: 2,
        failed: 0,
        skipped: 0,
      },
      createdAt: iso(-160),
      updatedAt: iso(-150),
    },
    {
      instructionId: 'instruction-20260327-002',
      sourceType: 'incoming_message',
      sourceMessageId: 'wamid.demo.002',
      mode: 'confirmed',
      status: 'running',
      targetGroupJids: [groups[2].groupJid],
      actionCounts: {
        pending: 0,
        running: 1,
        completed: 0,
        failed: 0,
        skipped: 0,
      },
      createdAt: iso(-48),
      updatedAt: iso(-8),
    },
    {
      instructionId: 'instruction-20260327-003',
      sourceType: 'manual_distribution',
      sourceMessageId: null,
      mode: 'dry_run',
      status: 'queued',
      targetGroupJids: [groups[4].groupJid, groups[5].groupJid],
      actionCounts: {
        pending: 2,
        running: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      },
      createdAt: iso(-22),
      updatedAt: iso(-22),
    },
    {
      instructionId: 'instruction-20260327-004',
      sourceType: 'incoming_message',
      sourceMessageId: 'wamid.demo.004',
      mode: 'confirmed',
      status: 'partial_failed',
      targetGroupJids: [groups[0].groupJid, groups[3].groupJid],
      actionCounts: {
        pending: 0,
        running: 0,
        completed: 1,
        failed: 1,
        skipped: 0,
      },
      createdAt: iso(-90),
      updatedAt: iso(-66),
    },
  ];

  const watchdogIssues: WatchdogIssue[] = [
    {
      issueId: 'issue-overdue-001',
      kind: 'job_overdue',
      jobId: 'job-ballet-001',
      weekId: '2026-W13',
      groupJid: groups[0].groupJid,
      groupLabel: groups[0].preferredSubject,
      openedAt: iso(-42),
      status: 'open',
      summary: 'Aviso importante ultrapassou a hora prevista sem confirmacao.',
      resolvedAt: null,
    },
    {
      issueId: 'issue-confirmation-002',
      kind: 'waiting_confirmation_timeout',
      jobId: 'job-pilates-007',
      weekId: '2026-W13',
      groupJid: groups[2].groupJid,
      groupLabel: groups[2].preferredSubject,
      openedAt: iso(-130),
      status: 'open',
      summary: 'Mensagem observada mas sem confirmacao forte dentro da janela esperada.',
      resolvedAt: null,
    },
  ];

  const settings: SettingsSnapshot = {
    adminSettings: {
      ...DEFAULT_ADMIN_SETTINGS,
      llm: {
        enabled: true,
        provider: 'codex-oauth',
        model: 'gpt-5.4',
        streamingEnabled: true,
      },
      updatedAt: iso(-110),
    },
    powerStatus: {
      policy: {
        schemaVersion: 1,
        enabled: true,
        mode: 'on_demand',
        preferredReasons: ['whatsapp_connected', 'pending_jobs', 'watchdog_issue'],
        updatedAt: iso(-360),
      },
      activeLease: {
        leaseId: 'lease-preview-001',
        reasons: ['whatsapp_connected', 'pending_jobs'],
        explanation: 'O host fica acordado porque ha ligacao WhatsApp e entregas pendentes.',
        acquiredAt: iso(-50),
        releasedAt: null,
      },
      desiredState: 'inhibited',
      inhibitorActive: true,
      inhibitorStatePath: '/tmp/lumehub-demo-power-state.json',
      reasons: ['whatsapp_connected', 'pending_jobs'],
      explanation: 'O sistema manteve o PC acordado para evitar atrasos nas entregas.',
      updatedAt: iso(-5),
    },
    hostStatus: {
      schemaVersion: 1,
      hostId: 'host-kubuntu-demo',
      auth: {
        filePath: '/home/eliaspc/.codex/auth.json',
        exists: true,
        sameAsCodexCanonical: true,
      },
      autostart: {
        enabled: true,
        serviceName: 'lume-hub-host.service',
        manifestPath: '/home/eliaspc/.config/systemd/user/lume-hub-host.service',
        workingDirectory: '/home/eliaspc/Documentos/lume-hub/runtime/host/current',
        execStart: '/opt/node-v20.20.1-linux-x64/bin/node ./dist/main.js',
        installedAt: iso(-1_440),
      },
      runtime: {
        stateFilePath: '/home/eliaspc/.local/state/lume-hub/host-status.json',
        backendStateFilePath: '/home/eliaspc/.local/state/lume-hub/backend-status.json',
        lastRepairAt: iso(-360),
        lastHeartbeatAt: iso(-2),
        updatedAt: iso(-2),
        lastError: null,
      },
      power: {
        policyMode: 'on_demand',
        inhibitorActive: true,
        leaseId: 'lease-preview-001',
        explanation: 'Sem risco de suspensão enquanto o sistema estiver ativo.',
      },
      authRouter: {
        canonicalAuthFilePath: '/home/eliaspc/.codex/auth.json',
        currentAccountId: 'acct-main',
        currentSourceFilePath: '/home/eliaspc/.codex/auth.json',
        accountCount: 2,
        lastSwitchAt: iso(-510),
      },
    },
    authRouterStatus: {
      schemaVersion: 1,
      canonicalAuthFilePath: '/home/eliaspc/.codex/auth.json',
      canonicalExists: true,
      stateFilePath: '/home/eliaspc/.local/state/lume-hub/codex-auth-router.json',
      backupDirectoryPath: '/home/eliaspc/.local/state/lume-hub/codex-auth-backups',
      currentSelection: {
        accountId: 'acct-main',
        label: 'Conta principal',
        sourceFilePath: '/home/eliaspc/.codex/auth.json',
        canonicalAuthFilePath: '/home/eliaspc/.codex/auth.json',
        selectedAt: iso(-510),
        switchPerformed: false,
        backupFilePath: null,
        reason: 'preview_bootstrap',
        contentHash: 'demo-hash-main',
      },
      accounts: [
        {
          accountId: 'acct-main',
          label: 'Conta principal',
          sourceFilePath: '/home/eliaspc/.codex/auth.json',
          priority: 100,
          kind: 'canonical_live',
          exists: true,
          contentHash: 'demo-hash-main',
          bytes: 1_824,
          lastModifiedAt: iso(-180),
          usage: {
            successCount: 38,
            failureCount: 2,
            consecutiveFailures: 0,
            lastSuccessAt: iso(-16),
            lastFailureAt: iso(-980),
            lastFailureKind: 'quota',
            lastFailureReason: 'Limite temporario do provider.',
            cooldownUntil: null,
          },
        },
        {
          accountId: 'acct-backup',
          label: 'Conta secundaria',
          sourceFilePath: '/home/eliaspc/.codex/auth-secondary.json',
          priority: 80,
          kind: 'secondary',
          exists: true,
          contentHash: 'demo-hash-secondary',
          bytes: 1_790,
          lastModifiedAt: iso(-320),
          usage: {
            successCount: 11,
            failureCount: 1,
            consecutiveFailures: 0,
            lastSuccessAt: iso(-430),
            lastFailureAt: iso(-1_800),
            lastFailureKind: 'network',
            lastFailureReason: 'Timeout breve durante troca de conta.',
            cooldownUntil: null,
          },
        },
      ],
      switchHistory: [],
      lastPreparedAt: iso(-12),
      lastSwitchAt: iso(-510),
      lastError: null,
      accountCount: 2,
    },
  };

  const scheduleEvents: WeeklyPlannerEventSummary[] = [
    {
      eventId: 'event-ballet-001',
      weekId: '2026-W13',
      groupJid: groups[0].groupJid,
      groupLabel: groups[0].preferredSubject,
      title: 'Aula regular de sexta',
      eventAt: iso(60 * 24),
      localDate: '2026-03-27',
      dayLabel: 'sexta-feira',
      startTime: '18:30',
      durationMinutes: 60,
      notes: 'Levar musica e confirmar sala 2.',
      notificationRuleLabels: ['24h antes', '30 min antes'],
      notifications: {
        pending: 1,
        waitingConfirmation: 1,
        sent: 0,
        total: 2,
      },
    },
    {
      eventId: 'event-pilates-001',
      weekId: '2026-W13',
      groupJid: groups[2].groupJid,
      groupLabel: groups[2].preferredSubject,
      title: 'Pilates reforco',
      eventAt: iso(60 * 48),
      localDate: '2026-03-28',
      dayLabel: 'sabado',
      startTime: '10:00',
      durationMinutes: 75,
      notes: 'Reforcar material de apoio e confirmar presencas.',
      notificationRuleLabels: ['24h antes'],
      notifications: {
        pending: 1,
        waitingConfirmation: 0,
        sent: 1,
        total: 2,
      },
    },
  ];

  const instructionQueue = distributions.map((distribution, index): Instruction => ({
    instructionId: distribution.instructionId,
    sourceType: distribution.sourceType,
    sourceMessageId: distribution.sourceMessageId,
    mode: distribution.mode,
    status: distribution.status,
    metadata: {
      preview: 'demo',
      order: index + 1,
    },
    actions: distribution.targetGroupJids.map((groupJid, actionIndex) => ({
      actionId: `${distribution.instructionId}-action-${actionIndex + 1}`,
      type: 'distribution_delivery',
      dedupeKey: `${distribution.sourceMessageId ?? distribution.instructionId}:${groupJid}`,
      targetGroupJid: groupJid,
      payload: {
        targetGroupJid: groupJid,
      },
      status:
        distribution.status === 'queued'
          ? 'pending'
          : distribution.status === 'running'
            ? 'running'
            : distribution.status === 'partial_failed' && actionIndex === distribution.targetGroupJids.length - 1
              ? 'failed'
              : 'completed',
      attemptCount: distribution.status === 'queued' ? 0 : 1,
      lastError:
        distribution.status === 'partial_failed' && actionIndex === distribution.targetGroupJids.length - 1
          ? 'falha simulada de entrega'
          : null,
      result:
        distribution.status === 'queued'
          ? null
          : {
              note: distribution.mode === 'dry_run' ? 'dry-run' : 'demo-send',
              externalMessageId: distribution.sourceMessageId,
              metadata: {},
            },
      lastAttemptAt: distribution.updatedAt,
      completedAt: distribution.status === 'queued' || distribution.status === 'running' ? null : distribution.updatedAt,
    })),
    createdAt: distribution.createdAt,
    updatedAt: distribution.updatedAt,
  }));

  const llmModels: readonly LlmModelDescriptor[] = [
    {
      providerId: 'codex-oauth',
      modelId: 'gpt-5.4',
      label: 'Codex GPT-5.4',
      capabilities: {
        chat: true,
        scheduling: true,
        weeklyPlanning: true,
        streaming: true,
      },
    },
    {
      providerId: 'openai-compat',
      modelId: 'gpt-4o-mini',
      label: 'OpenAI compat GPT-4o mini',
      capabilities: {
        chat: true,
        scheduling: true,
        weeklyPlanning: false,
        streaming: true,
      },
    },
  ];

  const llmRuns: LlmRunLogEntry[] = [
    {
      runId: 'run-demo-001',
      operation: 'chat',
      providerId: 'codex-oauth',
      modelId: 'gpt-5.4',
      inputSummary: 'pedido de resumo para turma',
      outputSummary: 'resposta curta preparada para o operador',
      memoryScope: {
        scope: 'group',
        groupJid: groups[0].groupJid,
        groupLabel: groups[0].preferredSubject,
        instructionsSource: 'llm_instructions',
        instructionsApplied: true,
        knowledgeSnippetCount: 1,
        knowledgeDocuments: [
          {
            documentId: 'aula-1-ballet',
            title: 'Aula 1 de Ballet',
            filePath: 'aulas/aula-1.md',
            score: 0.92,
            matchedTerms: ['aula 1'],
          },
        ],
      },
      createdAt: iso(-14),
    },
    {
      runId: 'run-demo-002',
      operation: 'plan_weekly_prompts',
      providerId: 'codex-oauth',
      modelId: 'gpt-5.4',
      inputSummary: 'planeamento semanal com 2 eventos',
      outputSummary: '3 prompts sugeridos para esta semana',
      memoryScope: {
        scope: 'none',
        groupJid: null,
        groupLabel: null,
        instructionsSource: null,
        instructionsApplied: false,
        knowledgeSnippetCount: 0,
        knowledgeDocuments: [],
      },
      createdAt: iso(-55),
    },
  ];

  const conversationAudit: ConversationAuditRecord[] = [
    {
      auditId: 'audit-demo-001',
      messageId: 'wamid.demo.private.001',
      chatJid: '351910000001@s.whatsapp.net',
      chatType: 'private',
      personId: 'person-ana',
      intent: 'casual_chat',
      selectedTools: ['chat_reply'],
      replyMode: 'private',
      replyText: 'Resposta demo preparada para a operadora.',
      targetChatType: 'private',
      targetChatJid: '351910000001@s.whatsapp.net',
      memoryUsage: {
        scope: 'group',
        groupJid: groups[0].groupJid,
        groupLabel: groups[0].preferredSubject,
        instructionsSource: 'llm_instructions',
        instructionsApplied: true,
        knowledgeSnippetCount: 1,
        knowledgeDocuments: [
          {
            documentId: 'aula-1-ballet',
            title: 'Aula 1 de Ballet',
            filePath: 'aulas/aula-1.md',
          },
        ],
      },
      schedulingInsight: null,
      createdAt: iso(-16),
    },
    {
      auditId: 'audit-demo-002',
      messageId: 'wamid.demo.group.002',
      chatJid: groups[0].groupJid,
      chatType: 'group',
      personId: 'person-ana',
      intent: 'scheduling_request',
      selectedTools: ['schedule_parse', 'chat_reply'],
      replyMode: 'private',
      replyText: 'Mudei para privado para evitar ruido no grupo.',
      targetChatType: 'private',
      targetChatJid: '351910000001@s.whatsapp.net',
      memoryUsage: {
        scope: 'group',
        groupJid: groups[0].groupJid,
        groupLabel: groups[0].preferredSubject,
        instructionsSource: 'llm_instructions',
        instructionsApplied: true,
        knowledgeSnippetCount: 1,
        knowledgeDocuments: [
          {
            documentId: 'aula-1-ballet',
            title: 'Aula 1 de Ballet',
            filePath: 'aulas/aula-1.md',
          },
        ],
      },
      schedulingInsight: {
        requestedAccessMode: 'read',
        resolvedGroupJids: [groups[0].groupJid],
        memoryScope: 'group',
        memoryGroupJid: groups[0].groupJid,
        memoryGroupLabel: groups[0].preferredSubject,
      },
      createdAt: iso(-44),
    },
  ];

  const mediaAssets: MediaAssetSnapshot[] = [
    {
      assetId: '9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1001',
      mediaType: 'video',
      mimeType: 'video/mp4',
      sha256: '9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1001',
      fileSize: 18_452_221,
      sourceChatJid: groups[0]!.groupJid,
      sourceMessageId: 'wamid.demo.media.0001',
      caption: 'Video de demonstracao para a aula de sexta.',
      storedAt: iso(-12),
      assetRootPath: '/demo/runtime/media/assets/9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1001',
      binaryPath: '/demo/runtime/media/assets/9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1001/binary',
      metadataPath: '/demo/runtime/media/assets/9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1001/metadata.json',
      exists: true,
      retentionPolicy: {
        mode: 'manual',
        deleteAfterDays: null,
        description: 'Demo sem expiracao automatica.',
      },
    },
    {
      assetId: '9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1002',
      mediaType: 'document',
      mimeType: 'application/pdf',
      sha256: '9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1002',
      fileSize: 284_112,
      sourceChatJid: '351910000001@s.whatsapp.net',
      sourceMessageId: 'wamid.demo.media.0002',
      caption: 'Plano da apresentacao final.',
      storedAt: iso(-95),
      assetRootPath: '/demo/runtime/media/assets/9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1002',
      binaryPath: '/demo/runtime/media/assets/9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1002/binary',
      metadataPath: '/demo/runtime/media/assets/9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1002/metadata.json',
      exists: true,
      retentionPolicy: {
        mode: 'manual',
        deleteAfterDays: null,
        description: 'Demo sem expiracao automatica.',
      },
    },
  ];

  const groupIntelligenceByGroupJid = createDemoGroupIntelligence(groups);

  return {
    groups,
    groupIntelligenceByGroupJid,
    mediaAssets,
    people: [
      {
        personId: 'person-ana',
        displayName: 'Ana Costa',
        identifiers: [{ kind: 'whatsapp_jid', value: '351910000001@s.whatsapp.net' }],
        globalRoles: ['member'],
        createdAt: iso(-4_300),
        updatedAt: iso(-240),
      },
      {
        personId: 'person-lucia',
        displayName: 'Lucia Matos',
        identifiers: [{ kind: 'whatsapp_jid', value: '351910000002@s.whatsapp.net' }],
        globalRoles: ['member'],
        createdAt: iso(-4_000),
        updatedAt: iso(-95),
      },
      {
        personId: 'person-rita',
        displayName: 'Rita Gomes',
        identifiers: [{ kind: 'whatsapp_jid', value: '351910000003@s.whatsapp.net' }],
        globalRoles: ['member'],
        createdAt: iso(-3_600),
        updatedAt: iso(-65),
      },
      {
        personId: 'person-marta',
        displayName: 'Marta Silva',
        identifiers: [{ kind: 'whatsapp_jid', value: '351910000010@s.whatsapp.net' }],
        globalRoles: ['app_owner'],
        createdAt: iso(-5_800),
        updatedAt: iso(-12),
      },
      {
        personId: 'person-tiago',
        displayName: 'Tiago Ferreira',
        identifiers: [{ kind: 'whatsapp_jid', value: '351910000011@s.whatsapp.net' }],
        globalRoles: ['member'],
        createdAt: iso(-3_900),
        updatedAt: iso(-18),
      },
      {
        personId: 'person-joao',
        displayName: 'Joao Martins',
        identifiers: [{ kind: 'whatsapp_jid', value: '351910000012@s.whatsapp.net' }],
        globalRoles: ['member'],
        createdAt: iso(-3_700),
        updatedAt: iso(-27),
      },
    ],
    routingRules,
    distributions,
    instructionQueue,
    scheduleEvents,
    watchdogIssues,
    llmModels,
    llmRuns,
    conversationAudit,
    settings,
    externalPrivateConversations: [
      {
        personId: null,
        displayName: 'Contacto externo sem mapeamento',
        whatsappJids: ['351910000099@s.whatsapp.net'],
        globalRoles: ['member'],
        privateAssistantAuthorized: false,
        ownedGroupJids: [],
        knownToBot: false,
      },
    ],
  };
}

function createDemoGroupIntelligence(groups: readonly Group[]): Record<string, DemoGroupIntelligenceEntry> {
  const byGroupJid: Record<string, DemoGroupIntelligenceEntry> = {};

  for (const group of groups) {
    byGroupJid[group.groupJid] = {
      instructions: buildDemoInstructionsText(group),
      knowledgeDocuments: buildDemoKnowledgeDocuments(group),
    };
  }

  return byGroupJid;
}

function buildDemoInstructionsText(group: Group): string {
  return [
    `# Instrucoes LLM para ${group.preferredSubject}`,
    '',
    `- Usa ${group.preferredSubject} como nome canonico deste grupo.`,
    `- Trata ${group.aliases.join(', ') || 'os aliases conhecidos'} como referencias locais ao mesmo grupo.`,
    '- Responde com linguagem humana, curta e orientada a proximo passo.',
    '- Se a referencia a uma aula for ambigua, usa primeiro a knowledge base deste grupo antes de responder.',
    '- Nunca assumes que Aulas com o mesmo nome noutros grupos significam a mesma coisa aqui.',
    '',
  ].join('\n');
}

function buildDemoKnowledgeDocuments(group: Group): GroupKnowledgeDocumentSnapshot[] {
  const rootPath = buildDemoGroupKnowledgeRootPath(group.groupJid);

  const documentsByGroupJid: Record<string, GroupKnowledgeDocumentSnapshot[]> = {
    '120363407086801381@g.us': [
      createDemoKnowledgeDocument(group.groupJid, rootPath, {
        documentId: 'ballet-aula-1',
        filePath: 'aulas/aula-1.md',
        title: 'Aula 1 de Ballet Iniciacao',
        summary: 'Nesta turma, Aula 1 refere-se ao bloco tecnico base.',
        aliases: ['Aula 1', 'Ballet Basico'],
        tags: ['ballet', 'iniciacao'],
        content:
          '# Aula 1\n\nA Aula 1 desta turma e o bloco tecnico base. Confirmar sala 2 e levar musica de aquecimento.\n',
      }),
      createDemoKnowledgeDocument(group.groupJid, rootPath, {
        documentId: 'ballet-recados',
        filePath: 'operacao/recados.md',
        title: 'Recados frequentes',
        summary: 'Padroes para faltas, troca de sala e material.',
        aliases: ['recados'],
        tags: ['operacao'],
        content:
          '# Recados\n\nQuando houver troca de sala, responder de forma curta e pedir confirmacao de leitura.\n',
      }),
    ],
    '120363407086801382@g.us': [
      createDemoKnowledgeDocument(group.groupJid, rootPath, {
        documentId: 'contemporaneo-aula-1',
        filePath: 'aulas/aula-1.md',
        title: 'Aula 1 de Contemporaneo Jovens',
        summary: 'Aqui, Aula 1 refere-se ao ensaio coreografico inicial.',
        aliases: ['Aula 1', 'Contemporaneo'],
        tags: ['contemporaneo', 'jovens'],
        content:
          '# Aula 1\n\nA Aula 1 deste grupo e o ensaio coreografico inicial. Confirmar figurino leve e chegada 10 minutos antes.\n',
      }),
    ],
    '120363407086801383@g.us': [
      createDemoKnowledgeDocument(group.groupJid, rootPath, {
        documentId: 'pilates-material',
        filePath: 'operacao/material.md',
        title: 'Material de Pilates Adultos',
        summary: 'Check-list operacional para aulas com reforco.',
        aliases: ['material'],
        tags: ['pilates', 'operacao'],
        content:
          '# Material\n\nLevar tapetes extra, reforcar toalha e lembrar os participantes de confirmar presenca.\n',
      }),
    ],
  };

  return documentsByGroupJid[group.groupJid] ?? [];
}

function createDemoKnowledgeDocument(
  groupJid: string,
  rootPath: string,
  input: {
    readonly documentId: string;
    readonly filePath: string;
    readonly title: string;
    readonly summary: string | null;
    readonly aliases: readonly string[];
    readonly tags: readonly string[];
    readonly content: string;
  },
): GroupKnowledgeDocumentSnapshot {
  return {
    groupJid,
    documentId: input.documentId,
    filePath: input.filePath,
    absoluteFilePath: `${rootPath}/${input.filePath}`,
    title: input.title,
    summary: input.summary,
    aliases: input.aliases,
    tags: input.tags,
    enabled: true,
    exists: true,
    content: input.content,
  };
}

function buildDemoGroupIntelligenceSnapshot(state: DemoState, groupJid: string): GroupIntelligenceSnapshot {
  const entry = state.groupIntelligenceByGroupJid[groupJid] ?? {
    instructions: '',
    knowledgeDocuments: [],
  };
  const instructions = entry.instructions.trim();
  const primaryFilePath = buildDemoGroupInstructionsPath(groupJid);

  return {
    groupJid,
    instructions: {
      primaryFilePath,
      resolvedFilePath: instructions.length > 0 ? primaryFilePath : null,
      exists: instructions.length > 0,
      source: instructions.length > 0 ? 'llm_instructions' : 'missing',
      content: instructions.length > 0 ? entry.instructions : null,
    },
    knowledge: {
      indexFilePath: buildDemoGroupKnowledgeIndexPath(groupJid),
      exists: entry.knowledgeDocuments.length > 0,
      documents: [...entry.knowledgeDocuments].sort((left, right) => left.title.localeCompare(right.title, 'pt-PT')),
    },
  };
}

function upsertDemoGroupKnowledgeDocument(
  state: DemoState,
  groupJid: string,
  body: Record<string, unknown>,
): GroupKnowledgeDocumentSnapshot {
  const entry = state.groupIntelligenceByGroupJid[groupJid] ?? {
    instructions: '',
    knowledgeDocuments: [],
  };
  const documentId = readDemoRequiredString(body.documentId, 'documentId');
  const filePath = readDemoRequiredString(body.filePath, 'filePath');
  const nextDocument: GroupKnowledgeDocumentSnapshot = {
    groupJid,
    documentId,
    filePath,
    absoluteFilePath: `${buildDemoGroupKnowledgeRootPath(groupJid)}/${filePath}`,
    title: readDemoRequiredString(body.title, 'title'),
    summary: body.summary === null ? null : readDemoOptionalString(body.summary),
    aliases: readDemoStringArray(body.aliases),
    tags: readDemoStringArray(body.tags),
    enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
    exists: true,
    content: ensureDemoTrailingNewline(readDemoRequiredString(body.content, 'content')),
  };
  const nextDocuments = entry.knowledgeDocuments.filter((document) => document.documentId !== nextDocument.documentId);
  nextDocuments.push(nextDocument);
  nextDocuments.sort((left, right) => left.title.localeCompare(right.title, 'pt-PT'));
  state.groupIntelligenceByGroupJid[groupJid] = {
    ...entry,
    knowledgeDocuments: nextDocuments,
  };
  return nextDocument;
}

function deleteDemoGroupKnowledgeDocument(
  state: DemoState,
  groupJid: string,
  documentId: string,
): {
  readonly groupJid: string;
  readonly documentId: string;
  readonly filePath: string | null;
  readonly deleted: boolean;
} {
  const entry = state.groupIntelligenceByGroupJid[groupJid] ?? {
    instructions: '',
    knowledgeDocuments: [],
  };
  const target = entry.knowledgeDocuments.find((document) => document.documentId === documentId) ?? null;

  if (!target) {
    return {
      groupJid,
      documentId,
      filePath: null,
      deleted: false,
    };
  }

  state.groupIntelligenceByGroupJid[groupJid] = {
    ...entry,
    knowledgeDocuments: entry.knowledgeDocuments.filter((document) => document.documentId !== documentId),
  };

  return {
    groupJid,
    documentId,
    filePath: target.filePath,
    deleted: true,
  };
}

function buildDemoGroupContextPreview(
  state: DemoState,
  groupJid: string,
  body: {
    readonly text?: string;
    readonly personId?: string | null;
    readonly senderDisplayName?: string | null;
  },
): GroupContextPreviewSnapshot {
  const group = state.groups.find((candidate) => candidate.groupJid === groupJid);

  if (!group) {
    throw new Error(`Demo group ${groupJid} not found.`);
  }

  const intelligence = buildDemoGroupIntelligenceSnapshot(state, groupJid);
  const query = typeof body.text === 'string' ? body.text.trim() : '';
  const matchedTerms = tokenizeDemoQuery(query);
  const groupKnowledgeSnippets = intelligence.knowledge.documents
    .filter((document) => document.enabled && document.exists && document.content)
    .map((document) => {
      const haystack = `${document.title}\n${document.summary ?? ''}\n${document.aliases.join(' ')}\n${document.tags.join(' ')}\n${document.content ?? ''}`;
      const documentTerms = matchedTerms.filter((term) => haystack.toLowerCase().includes(term));
      return {
        document,
        score: documentTerms.length,
        matchedTerms: documentTerms,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.document.title.localeCompare(right.document.title, 'pt-PT'))
    .slice(0, 3)
    .map((candidate) => ({
      groupJid,
      documentId: candidate.document.documentId,
      title: candidate.document.title,
      filePath: candidate.document.filePath,
      absoluteFilePath: candidate.document.absoluteFilePath,
      score: candidate.score,
      excerpt: buildDemoExcerpt(candidate.document.content ?? '', candidate.matchedTerms[0] ?? null),
      matchedTerms: candidate.matchedTerms,
      source: 'group_knowledge' as const,
    }));
  const person = body.personId ? state.people.find((candidate) => candidate.personId === body.personId) ?? null : null;

  return {
    chatJid: groupJid,
    chatType: 'group',
    currentText: query,
    personId: person?.personId ?? body.personId ?? null,
    senderDisplayName:
      (typeof body.senderDisplayName === 'string' && body.senderDisplayName.trim().length > 0
        ? body.senderDisplayName.trim()
        : null) ?? person?.displayName ?? null,
    groupJid,
    group: {
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
      aliases: group.aliases,
      courseId: group.courseId,
    },
    groupInstructions: intelligence.instructions.content,
    groupInstructionsSource: intelligence.instructions.source,
    groupKnowledgeSnippets,
    groupPolicy: {
      aliases: group.aliases,
      calendarAccessPolicy: group.calendarAccessPolicy,
      ownerPersonIds: group.groupOwners.map((owner) => owner.personId),
    },
    generatedAt: new Date().toISOString(),
  };
}

function buildDemoExcerpt(content: string, focusTerm: string | null): string {
  const normalized = content.replace(/\s+/gu, ' ').trim();

  if (!focusTerm) {
    return normalized.slice(0, 180);
  }

  const lower = normalized.toLowerCase();
  const index = lower.indexOf(focusTerm.toLowerCase());

  if (index < 0) {
    return normalized.slice(0, 180);
  }

  const start = Math.max(0, index - 42);
  const end = Math.min(normalized.length, index + 138);
  return normalized.slice(start, end).trim();
}

function tokenizeDemoQuery(query: string): readonly string[] {
  return [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3))];
}

function buildDemoGroupRootPath(groupJid: string): string {
  return `/home/eliaspc/Documentos/lume-hub/runtime/demo-data/groups/${encodeURIComponent(groupJid)}`;
}

function buildDemoGroupInstructionsPath(groupJid: string): string {
  return `${buildDemoGroupRootPath(groupJid)}/llm/instructions.md`;
}

function buildDemoGroupKnowledgeRootPath(groupJid: string): string {
  return `${buildDemoGroupRootPath(groupJid)}/knowledge`;
}

function buildDemoGroupKnowledgeIndexPath(groupJid: string): string {
  return `${buildDemoGroupKnowledgeRootPath(groupJid)}/index.json`;
}

function readDemoRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Demo field '${fieldName}' must be a non-empty string.`);
  }

  return value.trim();
}

function readDemoOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readDemoStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function ensureDemoTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}

function buildDashboardSnapshot(state: DemoState): DashboardSnapshot {
  return {
    health: {
      status: 'healthy',
      ready: true,
      modules: [
        { status: 'healthy', details: { module: 'backend', latencyMs: 38 } },
        { status: 'healthy', details: { module: 'whatsapp', lastSyncAt: state.settings.hostStatus.runtime.lastHeartbeatAt } },
        { status: 'healthy', details: { module: 'dispatcher', activeWorkers: 1 } },
      ],
      jobs: {
        pending: 6,
        waitingConfirmation: 2,
        sent: 18,
      },
      watchdog: {
        openIssues: state.watchdogIssues.length,
      },
    },
    readiness: {
      ready: true,
      status: 'healthy',
    },
    groups: {
      total: state.groups.length,
      withOwners: state.groups.filter((group) => group.groupOwners.length > 0).length,
      readWriteGroupOwnerAccess: state.groups.filter((group) => group.calendarAccessPolicy.groupOwner === 'read_write').length,
    },
    routing: {
      totalRules: state.routingRules.length,
      confirmationRules: state.routingRules.filter((rule) => rule.requiresConfirmation).length,
      totalPlannedTargets: state.routingRules.reduce(
        (total, rule) =>
          total + rule.targetGroupJids.length + rule.targetCourseIds.length + rule.targetDisciplineCodes.length,
        0,
      ),
    },
    distributions: {
      total: state.distributions.length,
      queued: state.distributions.filter((distribution) => distribution.status === 'queued').length,
      running: state.distributions.filter((distribution) => distribution.status === 'running').length,
      completed: state.distributions.filter((distribution) => distribution.status === 'completed').length,
      partialFailed: state.distributions.filter((distribution) => distribution.status === 'partial_failed').length,
      failed: state.distributions.filter((distribution) => distribution.status === 'failed').length,
    },
    watchdog: {
      openIssues: state.watchdogIssues.length,
      recentIssues: state.watchdogIssues.map((issue) => ({
        issueId: issue.issueId,
        kind: issue.kind,
        groupLabel: issue.groupLabel,
        summary: issue.summary,
        openedAt: issue.openedAt,
      })),
    },
    hostCompanion: {
      hostId: state.settings.hostStatus.hostId,
      authExists: state.settings.hostStatus.auth.exists,
      sameAsCodexCanonical: state.settings.hostStatus.auth.sameAsCodexCanonical,
      autostartEnabled: state.settings.hostStatus.autostart.enabled,
      lastHeartbeatAt: state.settings.hostStatus.runtime.lastHeartbeatAt,
      lastError: state.settings.hostStatus.runtime.lastError,
    },
    whatsapp: {
      phase: state.settings.adminSettings.whatsapp.enabled ? 'open' : 'disabled',
      connected: state.settings.adminSettings.whatsapp.enabled,
      loginRequired: !state.settings.adminSettings.whatsapp.enabled,
      discoveredGroups: state.groups.length,
      discoveredConversations:
        state.people.filter((person) => person.identifiers.some((identifier) => identifier.kind === 'whatsapp_jid')).length +
        state.externalPrivateConversations.length,
    },
  };
}

function buildStatusSnapshot(state: DemoState): StatusSnapshot {
  const dashboard = buildDashboardSnapshot(state);

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

function buildWeeklyPlannerSnapshot(state: DemoState): WeeklyPlannerSnapshot {
  const events = [...state.scheduleEvents].sort(
    (left, right) => left.eventAt.localeCompare(right.eventAt) || left.eventId.localeCompare(right.eventId),
  );

  return {
    timezone: 'Europe/Lisbon',
    focusWeekLabel: '2026-W13',
    focusWeekRangeLabel: '2026-03-23 ate 2026-03-29',
    groupsKnown: state.groups.length,
    groups: state.groups.map((group) => ({
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
      courseId: group.courseId,
      ownerLabels: group.groupOwners.map((owner) => owner.personId),
    })),
    defaultNotificationRuleLabels: state.settings.adminSettings.ui.defaultNotificationRules.map(
      (rule) => rule.label ?? rule.kind,
    ),
    events,
    diagnostics: {
      eventCount: events.length,
      pendingNotifications: events.reduce((sum, event) => sum + event.notifications.pending, 0),
      waitingConfirmationNotifications: events.reduce(
        (sum, event) => sum + event.notifications.waitingConfirmation,
        0,
      ),
      sentNotifications: events.reduce((sum, event) => sum + event.notifications.sent, 0),
    },
  };
}

function buildWhatsAppWorkspaceSnapshot(state: DemoState): WhatsAppWorkspaceSnapshot {
  const peopleById = new Map(state.people.map((person) => [person.personId, person]));
  const ownedGroupsByPersonId = new Map<string, string[]>();

  for (const group of state.groups) {
    for (const owner of group.groupOwners) {
      const groups = ownedGroupsByPersonId.get(owner.personId) ?? [];
      groups.push(group.groupJid);
      ownedGroupsByPersonId.set(owner.personId, groups);
    }
  }

  const commands = state.settings.adminSettings.commands;
  const whatsappEnabled = state.settings.adminSettings.whatsapp.enabled;
  const allowAllGroups = commands.authorizedGroupJids.length === 0;
  const allowAllPrivateChats = commands.authorizedPrivateJids.length === 0;

  const groupSummaries: WhatsAppGroupSummary[] = state.groups.map((group) => ({
    groupJid: group.groupJid,
    preferredSubject: group.preferredSubject,
    aliases: group.aliases,
    courseId: group.courseId,
    ownerPersonIds: group.groupOwners.map((owner) => owner.personId),
    ownerLabels: group.groupOwners.map((owner) => peopleById.get(owner.personId)?.displayName ?? owner.personId),
    assistantAuthorized:
      commands.assistantEnabled &&
      state.settings.adminSettings.whatsapp.enabled &&
      (allowAllGroups || commands.authorizedGroupJids.includes(group.groupJid)),
    calendarAccessPolicy: group.calendarAccessPolicy,
    lastRefreshedAt: group.lastRefreshedAt,
    knownToBot: true,
  }));

  const conversations = [
    ...state.people
    .filter((person) => person.identifiers.some((identifier) => identifier.kind === 'whatsapp_jid'))
      .map((person) =>
        mapPersonToConversationSummary(person, ownedGroupsByPersonId, commands, whatsappEnabled, allowAllPrivateChats),
      ),
    ...state.externalPrivateConversations.map((conversation) => ({
      ...conversation,
      privateAssistantAuthorized:
        commands.assistantEnabled &&
        whatsappEnabled &&
        commands.allowPrivateAssistant &&
        (allowAllPrivateChats ||
          conversation.whatsappJids.some((chatJid) => commands.authorizedPrivateJids.includes(chatJid))),
    })),
  ];

  const appOwners = state.people
    .filter((person) => person.globalRoles.includes('app_owner'))
    .map((person) =>
      mapPersonToConversationSummary(person, ownedGroupsByPersonId, commands, whatsappEnabled, allowAllPrivateChats),
    );

  return {
    settings: {
      commands,
      whatsapp: state.settings.adminSettings.whatsapp,
    },
    runtime: {
      session: {
        phase: whatsappEnabled ? 'open' : 'disabled',
        connected: whatsappEnabled,
        loginRequired: !whatsappEnabled,
        sessionPresent: state.settings.hostStatus.auth.exists,
        lastQrAt: whatsappEnabled ? null : state.settings.hostStatus.runtime.updatedAt,
        lastConnectedAt: whatsappEnabled ? state.settings.hostStatus.runtime.updatedAt : null,
        lastDisconnectAt: whatsappEnabled ? null : state.settings.hostStatus.runtime.updatedAt,
        lastDisconnectReason: whatsappEnabled ? null : 'disabled_for_preview',
        lastError: null,
        selfJid: '351910000099@s.whatsapp.net',
        pushName: 'Conta LumeHub Demo',
      },
      qr: {
        available: !whatsappEnabled,
        value: !whatsappEnabled ? 'lumehub-demo-qr' : null,
        svg: null,
        updatedAt: !whatsappEnabled ? state.settings.hostStatus.runtime.updatedAt : null,
        expiresAt: !whatsappEnabled ? state.settings.hostStatus.runtime.updatedAt : null,
      },
      discoveredGroups: groupSummaries.length,
      discoveredConversations: conversations.length,
      lastDiscoveryAt:
        [...groupSummaries.map((group) => group.lastRefreshedAt ?? ''), state.settings.hostStatus.runtime.updatedAt]
          .filter((value) => value.length > 0)
          .sort()
          .at(-1) ?? null,
    },
    host: {
      authFilePath: state.settings.hostStatus.auth.filePath,
      canonicalAuthFilePath:
        state.settings.authRouterStatus?.canonicalAuthFilePath ?? state.settings.hostStatus.auth.filePath,
      authExists: state.settings.hostStatus.auth.exists,
      sameAsCodexCanonical: state.settings.hostStatus.auth.sameAsCodexCanonical,
      autostartEnabled: state.settings.hostStatus.autostart.enabled,
      lastHeartbeatAt: state.settings.hostStatus.runtime.lastHeartbeatAt,
    },
    groups: groupSummaries.sort(compareByLabel),
    conversations: conversations.sort(compareByLabel),
    appOwners: appOwners.sort(compareByLabel),
    permissionSummary: {
      knownGroups: groupSummaries.filter((group) => group.knownToBot).length,
      authorizedGroups: groupSummaries.filter((group) => group.assistantAuthorized).length,
      knownPrivateConversations: conversations.filter((conversation) => conversation.knownToBot).length,
      authorizedPrivateConversations: conversations.filter((conversation) => conversation.privateAssistantAuthorized).length,
      appOwners: appOwners.length,
    },
  };
}

function upsertDemoSchedule(state: DemoState, payload: Record<string, unknown>): WeeklyPlannerEventSummary {
  const eventId = typeof payload.eventId === 'string' && payload.eventId.length > 0 ? payload.eventId : `event-demo-${Date.now()}`;
  const groupJid = String(payload.groupJid ?? '');
  const group = state.groups.find((candidate) => candidate.groupJid === groupJid) ?? state.groups[0];
  const title = String(payload.title ?? 'Novo agendamento');
  const dayLabel = String(payload.dayLabel ?? 'sexta-feira');
  const localDate = String(payload.localDate ?? resolveDemoLocalDate(dayLabel));
  const startTime = String(payload.startTime ?? '18:30');
  const durationMinutes =
    typeof payload.durationMinutes === 'number' && Number.isFinite(payload.durationMinutes)
      ? payload.durationMinutes
      : 60;
  const notes = typeof payload.notes === 'string' ? payload.notes : '';
  const notificationRuleLabels = Array.isArray(payload.notificationRules)
    ? payload.notificationRules
        .map((rule) => (rule && typeof rule === 'object' && 'label' in rule ? String((rule as { label?: unknown }).label ?? '') : ''))
        .filter((label) => label.length > 0)
    : state.settings.adminSettings.ui.defaultNotificationRules.map((rule) => rule.label ?? rule.kind);
  const eventAt = `${localDate}T${startTime}:00.000Z`;
  const nextEvent: WeeklyPlannerEventSummary = {
    eventId,
    weekId: '2026-W13',
    groupJid: group.groupJid,
    groupLabel: group.preferredSubject,
    title,
    eventAt,
    localDate,
    dayLabel,
    startTime,
    durationMinutes,
    notes,
    notificationRuleLabels,
    notifications: {
      pending: notificationRuleLabels.length,
      waitingConfirmation: 0,
      sent: 0,
      total: notificationRuleLabels.length,
    },
  };
  const existingIndex = state.scheduleEvents.findIndex((event) => event.eventId === eventId);

  if (existingIndex >= 0) {
    state.scheduleEvents.splice(existingIndex, 1, nextEvent);
  } else {
    state.scheduleEvents.unshift(nextEvent);
  }

  return nextEvent;
}

function buildDemoDistributionPlan(state: DemoState, payload: Record<string, unknown>): DistributionPlan {
  const ruleId = typeof payload.ruleId === 'string' && payload.ruleId.length > 0 ? payload.ruleId : state.routingRules[0]?.ruleId;
  const rule = state.routingRules.find((candidate) => candidate.ruleId === ruleId) ?? state.routingRules[0];

  return {
    sourceMessageId:
      typeof payload.sourceMessageId === 'string' && payload.sourceMessageId.length > 0
        ? payload.sourceMessageId
        : `preview-${Date.now()}`,
    senderPersonId: rule?.personId ?? null,
    senderDisplayName: state.people.find((person) => person.personId === rule?.personId)?.displayName ?? null,
    matchedRuleIds: rule ? [rule.ruleId] : [],
    matchedDisciplineCodes: rule?.targetDisciplineCodes ?? [],
    requiresConfirmation: rule?.requiresConfirmation ?? true,
    targetCount: rule?.targetGroupJids.length ?? 0,
    targets:
      rule?.targetGroupJids.map((groupJid) => {
        const group = state.groups.find((candidate) => candidate.groupJid === groupJid);
        return {
          groupJid,
          preferredSubject: group?.preferredSubject ?? groupJid,
          courseId: group?.courseId ?? null,
          reasons: ['demo_rule_match'],
          dedupeKey: `${payload.sourceMessageId ?? 'preview'}:${groupJid}`,
        };
      }) ?? [],
  };
}

function createDemoDistribution(state: DemoState, payload: Record<string, unknown>): DistributionExecutionResult {
  const plan = buildDemoDistributionPlan(state, payload);
  const mode = payload.mode === 'confirmed' ? 'confirmed' : 'dry_run';
  const nowIso = new Date().toISOString();
  const summary: DistributionSummary = {
    instructionId: `instruction-demo-${Date.now()}`,
    sourceType: 'manual_distribution',
    sourceMessageId: plan.sourceMessageId,
    mode,
    status: mode === 'confirmed' ? 'queued' : 'queued',
    targetGroupJids: plan.targets.map((target) => target.groupJid),
    actionCounts: {
      pending: plan.targets.length,
      running: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const instruction: Instruction = {
    instructionId: summary.instructionId,
    sourceType: summary.sourceType,
    sourceMessageId: summary.sourceMessageId,
    mode,
    status: 'queued',
    metadata: {
      targetCount: plan.targetCount,
      matchedRuleIds: plan.matchedRuleIds,
    },
    actions: plan.targets.map((target, index) => ({
      actionId: `${summary.instructionId}-action-${index + 1}`,
      type: 'distribution_delivery',
      dedupeKey: target.dedupeKey,
      targetGroupJid: target.groupJid,
      payload: {
        targetLabel: target.preferredSubject,
        messageText: String(payload.messageText ?? ''),
      },
      status: 'pending',
      attemptCount: 0,
      lastError: null,
      result: null,
      lastAttemptAt: null,
      completedAt: null,
    })),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  state.distributions.unshift(summary);
  state.instructionQueue.unshift(instruction);

  return {
    plan,
    instruction: summary,
  };
}

function createDemoLlmChatResult(state: DemoState, payload: LlmChatInput): LlmChatResult {
  const result: LlmChatResult = {
    runId: `run-demo-${Date.now()}`,
    providerId: state.settings.adminSettings.llm.provider,
    modelId: state.settings.adminSettings.llm.model,
    text: `Resposta demo: ${payload.text.slice(0, 80)}`,
  };

  state.llmRuns.unshift({
    runId: result.runId,
    operation: 'chat',
    providerId: result.providerId,
    modelId: result.modelId,
    inputSummary: payload.text.slice(0, 120),
    outputSummary: result.text,
    createdAt: new Date().toISOString(),
  });

  return result;
}

function readRecentDemoEntries<T>(entries: readonly T[], pathname: string, fallbackLimit: number): readonly T[] {
  const url = new URL(pathname, 'http://lumehub.preview');
  const limit = Number.parseInt(url.searchParams.get('limit') ?? String(fallbackLimit), 10);
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : fallbackLimit;
  return entries.slice(0, safeLimit);
}

function resolveDemoLocalDate(dayLabel: string): string {
  switch (dayLabel) {
    case 'segunda-feira':
      return '2026-03-23';
    case 'terca-feira':
    case 'terça-feira':
      return '2026-03-24';
    case 'quarta-feira':
      return '2026-03-25';
    case 'quinta-feira':
      return '2026-03-26';
    case 'sabado':
    case 'sábado':
      return '2026-03-28';
    case 'domingo':
      return '2026-03-29';
    case 'sexta-feira':
    default:
      return '2026-03-27';
  }
}

function mapPersonToConversationSummary(
  person: Person,
  ownedGroupsByPersonId: ReadonlyMap<string, readonly string[]>,
  commands: CommandsPolicySettings,
  whatsappEnabled: boolean,
  allowAllPrivateChats: boolean,
): WhatsAppConversationSummary {
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
    knownToBot: whatsappJids.length > 0,
  };
}

function matchParameterizedPath(pathname: string, template: string): Record<string, string> | null {
  const pathSegments = pathname.split('/').filter(Boolean);
  const templateSegments = template.split('/').filter(Boolean);

  if (pathSegments.length !== templateSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < templateSegments.length; index += 1) {
    const templateSegment = templateSegments[index];
    const pathSegment = pathSegments[index];

    if (templateSegment.startsWith(':')) {
      params[templateSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }

    if (templateSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}

function compareByLabel(
  left: { readonly displayName?: string; readonly preferredSubject?: string },
  right: { readonly displayName?: string; readonly preferredSubject?: string },
): number {
  const leftLabel = left.displayName ?? left.preferredSubject ?? '';
  const rightLabel = right.displayName ?? right.preferredSubject ?? '';
  return leftLabel.localeCompare(rightLabel, 'pt-PT');
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function readFrontendBootConfig(): FrontendBootConfig {
  return window.__LUMEHUB_BOOT_CONFIG__ ?? {};
}

function normaliseWebSocketPath(path = '/ws'): string {
  const trimmed = path.trim();

  if (!trimmed) {
    return '/ws';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function parseHttpBody<T>(rawBody: string, contentType: string | null): T {
  if (rawBody.length === 0) {
    return undefined as T;
  }

  const normalizedBody = rawBody.trimStart();
  const declaredJson = contentType?.includes('application/json') ?? false;
  const looksJson = normalizedBody.startsWith('{') || normalizedBody.startsWith('[');

  if (declaredJson || looksJson) {
    try {
      return JSON.parse(rawBody) as T;
    } catch {
      throw new Error(
        'A ligacao live respondeu dados invalidos. Confirma se a API HTTP do LumeHub esta mesmo ativa nesta porta.',
      );
    }
  }

  if (normalizedBody.startsWith('<')) {
    throw new Error(
      'A ligacao live abriu a pagina web, mas nao encontrou a API do LumeHub nesta porta. Usa Demo ou arranca o backend HTTP real.',
    );
  }

  throw new Error(
    'A ligacao live respondeu num formato inesperado. Confirma se o backend do LumeHub esta a expor JSON nesta porta.',
  );
}
