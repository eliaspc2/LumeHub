import type {
  AdminSettings,
  DashboardSnapshot,
  DistributionSummary,
  FrontendApiRequest,
  FrontendApiResponse,
  FrontendApiTransport,
  FrontendUiEvent,
  Group,
  SettingsSnapshot,
  SenderAudienceRule,
  WhatsAppWorkspaceSnapshot,
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
    const body = rawBody.length > 0 ? (JSON.parse(rawBody) as T) : (undefined as T);

    return {
      statusCode: response.status,
      body,
    };
  }
}

class DemoFrontendApiTransport implements FrontendApiTransport {
  private readonly listeners = new Set<(event: FrontendUiEvent) => void>();
  private readonly snapshot = createDemoSnapshot();

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

    switch (pathname) {
      case '/api/dashboard':
        return this.ok(this.snapshot.dashboard);
      case '/api/groups':
        return this.ok(this.snapshot.groups);
      case '/api/routing/rules':
        return this.ok(this.snapshot.routingRules);
      case '/api/routing/distributions':
        return this.ok(this.snapshot.distributions);
      case '/api/whatsapp/workspace':
        return this.ok(this.snapshot.whatsAppWorkspace);
      case '/api/watchdog/issues':
        return this.ok(this.snapshot.watchdogIssues);
      case '/api/settings':
        return this.ok(this.snapshot.settings);
      default:
        return {
          statusCode: 404,
          body: {
            error: `Demo transport has no handler for ${request.method} ${pathname}.`,
          } as T,
        };
    }
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
}

function createDemoSnapshot(): {
  readonly dashboard: DashboardSnapshot;
  readonly groups: readonly Group[];
  readonly routingRules: readonly SenderAudienceRule[];
  readonly distributions: readonly DistributionSummary[];
  readonly watchdogIssues: readonly WatchdogIssue[];
  readonly settings: SettingsSnapshot;
  readonly whatsAppWorkspace: WhatsAppWorkspaceSnapshot;
} {
  const now = new Date();
  const iso = (minutesOffset = 0) => new Date(now.getTime() + minutesOffset * 60_000).toISOString();

  const groups: readonly Group[] = [
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

  const routingRules: readonly SenderAudienceRule[] = [
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

  const distributions: readonly DistributionSummary[] = [
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

  const watchdogIssues: readonly WatchdogIssue[] = [
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

  const dashboard: DashboardSnapshot = {
    health: {
      status: 'healthy',
      ready: true,
      modules: [
        { status: 'healthy', details: { module: 'backend', latencyMs: 38 } },
        { status: 'healthy', details: { module: 'whatsapp', lastSyncAt: iso(-7) } },
        { status: 'healthy', details: { module: 'dispatcher', activeWorkers: 1 } },
      ],
      jobs: {
        pending: 6,
        waitingConfirmation: 2,
        sent: 18,
      },
      watchdog: {
        openIssues: watchdogIssues.length,
      },
    },
    readiness: {
      ready: true,
      status: 'healthy',
    },
    groups: {
      total: groups.length,
      withOwners: groups.filter((group) => group.groupOwners.length > 0).length,
      readWriteGroupOwnerAccess: groups.filter((group) => group.calendarAccessPolicy.groupOwner === 'read_write').length,
    },
    routing: {
      totalRules: routingRules.length,
      confirmationRules: routingRules.filter((rule) => rule.requiresConfirmation).length,
      totalPlannedTargets: routingRules.reduce(
        (total, rule) =>
          total + rule.targetGroupJids.length + rule.targetCourseIds.length + rule.targetDisciplineCodes.length,
        0,
      ),
    },
    distributions: {
      total: distributions.length,
      queued: distributions.filter((distribution) => distribution.status === 'queued').length,
      running: distributions.filter((distribution) => distribution.status === 'running').length,
      completed: distributions.filter((distribution) => distribution.status === 'completed').length,
      partialFailed: distributions.filter((distribution) => distribution.status === 'partial_failed').length,
      failed: distributions.filter((distribution) => distribution.status === 'failed').length,
    },
    watchdog: {
      openIssues: watchdogIssues.length,
      recentIssues: watchdogIssues.map((issue) => ({
        issueId: issue.issueId,
        kind: issue.kind,
        groupLabel: issue.groupLabel,
        summary: issue.summary,
        openedAt: issue.openedAt,
      })),
    },
    hostCompanion: {
      hostId: settings.hostStatus.hostId,
      authExists: settings.hostStatus.auth.exists,
      sameAsCodexCanonical: settings.hostStatus.auth.sameAsCodexCanonical,
      autostartEnabled: settings.hostStatus.autostart.enabled,
      lastHeartbeatAt: settings.hostStatus.runtime.lastHeartbeatAt,
      lastError: settings.hostStatus.runtime.lastError,
    },
  };

  const whatsAppWorkspace: WhatsAppWorkspaceSnapshot = {
    settings: {
      commands: settings.adminSettings.commands,
      whatsapp: settings.adminSettings.whatsapp,
    },
    host: {
      authFilePath: settings.hostStatus.auth.filePath,
      canonicalAuthFilePath: settings.authRouterStatus?.canonicalAuthFilePath ?? settings.hostStatus.auth.filePath,
      authExists: settings.hostStatus.auth.exists,
      sameAsCodexCanonical: settings.hostStatus.auth.sameAsCodexCanonical,
      autostartEnabled: settings.hostStatus.autostart.enabled,
      lastHeartbeatAt: settings.hostStatus.runtime.lastHeartbeatAt,
    },
    groups: groups.map((group) => ({
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
      aliases: group.aliases,
      courseId: group.courseId,
      ownerPersonIds: group.groupOwners.map((owner) => owner.personId),
      ownerLabels: group.groupOwners.map((owner) => owner.personId.replace('person-', '').replace(/(^\w)/u, (value) => value.toUpperCase())),
      assistantAuthorized: group.groupJid !== groups[3].groupJid,
      calendarAccessPolicy: group.calendarAccessPolicy,
      lastRefreshedAt: group.lastRefreshedAt,
      knownToBot: true,
    })),
    conversations: [
      {
        personId: 'person-ana',
        displayName: 'Ana Costa',
        whatsappJids: ['351910000001@s.whatsapp.net'],
        globalRoles: ['member'],
        privateAssistantAuthorized: true,
        ownedGroupJids: [groups[0].groupJid],
        knownToBot: true,
      },
      {
        personId: 'person-lucia',
        displayName: 'Lucia Matos',
        whatsappJids: ['351910000002@s.whatsapp.net'],
        globalRoles: ['member'],
        privateAssistantAuthorized: true,
        ownedGroupJids: [groups[2].groupJid],
        knownToBot: true,
      },
      {
        personId: 'person-rita',
        displayName: 'Rita Gomes',
        whatsappJids: ['351910000003@s.whatsapp.net'],
        globalRoles: ['member'],
        privateAssistantAuthorized: false,
        ownedGroupJids: [groups[4].groupJid],
        knownToBot: true,
      },
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
    appOwners: [
      {
        personId: 'person-marta',
        displayName: 'Marta Silva',
        whatsappJids: ['351910000010@s.whatsapp.net'],
        globalRoles: ['app_owner'],
        privateAssistantAuthorized: true,
        ownedGroupJids: groups.map((group) => group.groupJid),
        knownToBot: true,
      },
    ],
    permissionSummary: {
      knownGroups: groups.length,
      authorizedGroups: groups.length - 1,
      knownPrivateConversations: 3,
      authorizedPrivateConversations: 2,
      appOwners: 1,
    },
  };

  return {
    dashboard,
    groups,
    routingRules,
    distributions,
    watchdogIssues,
    settings,
    whatsAppWorkspace,
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
