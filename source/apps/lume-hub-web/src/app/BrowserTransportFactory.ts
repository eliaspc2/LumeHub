import type {
  AdminSettings,
  CommandsPolicySettings,
  DashboardSnapshot,
  DistributionSummary,
  FrontendApiRequest,
  FrontendApiResponse,
  FrontendApiTransport,
  FrontendUiEvent,
  Group,
  GroupCalendarAccessPolicy,
  GroupOwnerAssignmentInput,
  Person,
  PersonRole,
  SettingsSnapshot,
  SenderAudienceRule,
  WhatsAppWorkspaceSnapshot,
  WhatsAppConversationSummary,
  WhatsAppGroupSummary,
  WatchdogIssue,
} from '@lume-hub/frontend-api-client';

export type FrontendTransportMode = 'demo' | 'live';

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

export function createInitialTransportMode(locationLike: Pick<Location, 'search'> = window.location): FrontendTransportMode {
  const params = new URLSearchParams(locationLike.search);
  return params.get('mode') === 'live' ? 'live' : 'demo';
}

export function createFrontendTransport(
  mode: FrontendTransportMode,
  options: {
    readonly baseUrl?: string;
  } = {},
): FrontendApiTransport {
  if (mode === 'live') {
    return new BrowserFetchFrontendApiTransport(options.baseUrl);
  }

  return new DemoFrontendApiTransport();
}

class BrowserFetchFrontendApiTransport implements FrontendApiTransport {
  constructor(private readonly baseUrl = window.location.origin) {}

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

    if (request.method === 'GET' && pathname === '/api/groups') {
      return this.ok(this.state.groups);
    }

    if (request.method === 'GET' && pathname === '/api/people') {
      return this.ok(this.state.people);
    }

    if (request.method === 'GET' && pathname === '/api/routing/rules') {
      return this.ok(this.state.routingRules);
    }

    if (request.method === 'GET' && pathname === '/api/routing/distributions') {
      return this.ok(this.state.distributions);
    }

    if (request.method === 'GET' && pathname === '/api/whatsapp/workspace') {
      return this.ok(buildWhatsAppWorkspaceSnapshot(this.state));
    }

    if (request.method === 'GET' && pathname === '/api/watchdog/issues') {
      return this.ok(this.state.watchdogIssues);
    }

    if (request.method === 'GET' && pathname === '/api/settings') {
      return this.ok(this.state.settings);
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
  people: Person[];
  routingRules: SenderAudienceRule[];
  distributions: DistributionSummary[];
  watchdogIssues: WatchdogIssue[];
  readonly externalPrivateConversations: readonly WhatsAppConversationSummary[];
  settings: SettingsSnapshot;
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

  return {
    groups,
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
    watchdogIssues,
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
